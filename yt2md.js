// ==UserScript==
// @name         YouTube to Markdown with Category
// @namespace    https://github.com/Universal-Invariant/APPS-SCRIPTS-GM-Y2MD
// @version      5.0
// @description  Extract YouTube data, transcript, category, and save as Markdown with server-based file management
// @author       You
// @match        https://www.youtube.com/watch*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_setClipboard
// @connect      localhost
// @connect      127.0.0.1
// @connect      youtube.com
// ==/UserScript==

function consolelog(...args) {
    // Filter out undefined values
    const filteredArgs = args.filter(arg => arg !== undefined);
    //console.log(...filteredArgs);
}

let __Y2M_INITIALIZED = false;
let __Y2M_OBSERVER = null;

(function () {
    'use strict';

    // --- Icon Constants ---
    const ICONS = {
        SAVE: '\uD83D\uDCBE',
        EDIT: '\u270F\uFE0F',
        SETTINGS: '\u2699\uFE0F',
        CHECK: '\u2713',
        CROSS: '\u2717',
        ARROW: '\u2192'
    };

    // --- Default Configuration ---
    const DEFAULT_SERVER_CONFIG = {
        enabled: true,
        host: '127.0.0.1',
        port: '18083',
        vaultName: 'Obsidian',
        basePath: 'YouTube'
    };

    const DEFAULT_APP_CONFIG = {
        useCategoryFolders: true,
        includeCategoryInFrontmatter: true,
        customCategoryMap: {}
    };

    // --- CSS Styles ---
    if (true) {
        GM  padding: 6px 10px;
            background: #ff4444;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
    `);
    }

    // --- Configuration Manager ---
    class ConfigManager {
        static getServerConfig() {
            return GM_getValue('serverConfig', DEFAULT_SERVER_CONFIG);
        }
        static saveServerConfig(config) {
            GM_setValue('serverConfig', {
                ...DEFAULT_SERVER_CONFIG,
                ...config
            });
        }
        static getAppConfig() {
            return GM_getValue('appConfig', DEFAULT_APP_CONFIG);
        }
        static saveAppConfig(config) {
            GM_setValue('appConfig', {
                ...DEFAULT_APP_CONFIG,
                ...config
            });
        }
    }

    // --- Server Manager ---
    class ServerManager {
        constructor() {
            this.config = ConfigManager.getServerConfig();
            this.isOnline = null;
            this.lastCheck = 0;
        }

        getBaseUrl() {
            return `http://${this.config.host}:${this.config.port}`;
        }

        getFilePath(filename) {
            const path = `${this.config.basePath}\\${filename}`.replace(/\//g, '\\');
            return path;
        }

        getFullUrl(endpoint, filename) {
            //var filePath = encodeURIComponent(this.getFilePath(filename));
            var filePath = encodeURI(this.getFilePath(filename));
            return `${this.getBaseUrl()}/${endpoint}/${this.config.vaultName}?${filePath}`;
        }

        async checkServerActive() {
            if (!this.config.enabled)
                return false;
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${this.getBaseUrl()}/ServerActive/`,
                    timeout: 3000,
                    onload: (response) => {
                        this.isOnline = (response.status === 200);
                        this.lastCheck = Date.now();
                        resolve(this.isOnline);
                    },
                    onerror: () => {
                        this.isOnline = false;
                        this.lastCheck = Date.now();
                        resolve(false);
                    }
                });
            });
        }

        async checkConnection() {
            if (!this.config.enabled) {
                this.isOnline = false;
                return false;
            }
            if (this.isOnline !== null && Date.now() - this.lastCheck < 30000) {
                return this.isOnline;
            }
            return await this.checkServerActive();
        }

        async fileExists(filename) {
            if (!this.config.enabled)
                return false;
            const online = await this.checkConnection();
            if (!online)
                return false;
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: this.getFullUrl('FileExists', filename),
                    timeout: 5000,
                    onload: (response) => {
                        resolve(response.status === 200);
                    },
                    onerror: () => {
                        resolve(false);
                    }
                });
            });
        }

        async readFile(filename) {
            consolelog("[Y2M] readFile(" + filename + ") - enabled = " + this.config.enabled)
            if (!this.config.enabled)
                return null;
            const online = await this.checkConnection();
            if (!online)
                return null;
            consolelog("[Y2M] full url = " + this.getFullUrl('ReadFile', filename))
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: this.getFullUrl('ReadFile', filename),
                    timeout: 5000,
                    onload: (response) => {
                        consolelog("[Y2M] Reading File", response)
                        if (response.status === 200) {
                            resolve(response.responseText);
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: () => {
                        resolve(null);
                    }
                });
            });
        }

        async editFile(filename) {
            consolelog("[Y2M] editFile(" + filename + ") - enabled = " + this.config.enabled)
            if (!this.config.enabled)
                return null;
            const online = await this.checkConnection();
            if (!online)
                return null;
            consolelog("[Y2M] full url = " + this.getFullUrl('EditFile', filename))
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: this.getFullUrl('EditFile', filename),
                    timeout: 5000,
                    onload: (response) => {
                        consolelog("[Y2M] Editing File", response)
                        if (response.status === 200) {
                            resolve(response.responseText);
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: () => {
                        resolve(null);
                    }
                });
            });
        }

        async writeFile(filename, content) {
            if (!this.config.enabled)
                return false;
            const online = await this.checkConnection();
            if (!online)
                return false;
            consolelog('[Y2M Server] Writing file:', filename);
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: this.getFullUrl('WriteFile', filename),
                    data: content,
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'text/plain; charset=UTF-8'
                    },
                    onload: (response) => {
                        consolelog('[Y2M Server] Write response:', response.status);
                        resolve(response.status === 200);
                    },
                    onerror: (error) => {
                        consolelog('[Y2M Server] Write error:', error);
                        resolve(false);
                    }
                });
            });
        }

        getConfig() {
            return this.config;
        }

        saveConfig(newConfig) {
            this.config = {
                ...this.config,
                ...newConfig
            };
            ConfigManager.saveServerConfig(this.config);
            this.isOnline = null;
        }
    }

    // --- Storage Manager (Only used when server is DISABLED) ---
    class StorageManager {
        static getSavedVideos() {
            return GM_getValue('savedVideos', {});
        }
        static markAsSaved(videoData, filename) {
            const saved = this.getSavedVideos();
            saved[videoData.id] = {
                title: videoData.title,
                channel: videoData.channel,
                category: videoData.category,
                url: videoData.url,
                filename: filename,
                savedAt: new Date().toISOString(),
                lastEdited: new Date().toISOString()
            };
            GM_setValue('savedVideos', saved);
        }
        static updateVideo(videoData, filename) {
            const saved = this.getSavedVideos();
            if (saved[videoData.id]) {
                saved[videoData.id].lastEdited = new Date().toISOString();
                saved[videoData.id].filename = filename;
                saved[videoData.id].title = videoData.title;
                saved[videoData.id].category = videoData.category;
                GM_setValue('savedVideos', saved);
                return true;
            }
            return false;
        }
        static getVideoData(videoId) {
            const saved = this.getSavedVideos();
            return saved[videoId] || null;
        }
    }

    // --- Data Extractor ---
    class YouTubeDataExtractor {
        getVideoId() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('v');
        }

        async waitForElements() {
            return new Promise((resolve) => {
                const maxWaitTime = 5000; // Increased from 3000
                const startTime = Date.now();
                const check = () => {
                    const title = this.extractTitle();
                    const channel = this.extractChannel();
                    const viewCount = this.extractViewCount(); // *** NEW: Also wait for view count ***

                    if (title && channel && viewCount !== 'Unknown' &&
                        title !== 'Unknown Title' && channel !== 'Unknown Channel') {
                        resolve();
                    } else if (Date.now() - startTime > maxWaitTime) {
                        resolve(); // Resolve anyway after timeout
                    } else {
                        setTimeout(check, 200); // Check more frequently
                    }
                };
                check();
            });
        }

        extractTitle() {
            const selectors = [
                'h1.ytd-watch-metadata yt-formatted-string',
                'h1 yt-formatted-string',
                '#title h1',
                'ytd-watch-metadata h1'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim())
                    return el.textContent.trim();
            }
            return 'Unknown Title';
        }

        extractChannel() {
            const selectors = [
                '#owner #channel-name a',
                '#channel-name a',
                '.ytd-channel-name a',
                'ytd-video-owner-renderer a'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim())
                    return el.textContent.trim();
            }
            return 'Unknown Channel';
        }

        async extractDescription() {
            const expander = document.querySelector('#description-inline-expander');
            if (!expander)
                return '';
            const isExpanded = expander.hasAttribute('is-expanded');
            const expandBtn = expander.querySelector('#expand');
            const collapseBtn = expander.querySelector('#collapse');
            if (!isExpanded && expandBtn && !expandBtn.hasAttribute('hidden')) {
                expandBtn.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            let description = '';
            const expandedContent = expander.querySelector('#expanded yt-attributed-string');
            if (expandedContent) {
                description = expandedContent.textContent.trim();
            }
            if (!description) {
                const altContent = expander.querySelector('#expanded');
                if (altContent) {
                    description = altContent.textContent.trim();
                }
            }
            if (!isExpanded && collapseBtn && !collapseBtn.hasAttribute('hidden')) {
                setTimeout(() => {
                    collapseBtn.click();
                }, 500);
            }
            if (description.length > 2000) {
                description = description.substring(0, 2000) + '...';
            }
            return description;
        }

        extractViewCount() {
            // Primary: Extract from #info element textContent
            const infoEl = document.querySelector('#info-container #info');
            if (infoEl && infoEl.textContent) {
                const text = infoEl.textContent.trim();
                consolelog('[Y2M Debug] #info textContent:', text);
                // Format: "4,821 views  9 hours ago"
                const match = text.match(/^([\d,\.]+[KMB]?)\s+views/i);
                if (match && match[1]) {
                    return match[1];
                }
            }

            // Secondary: Try tooltip
            const tooltip = document.querySelector('#info-container + tp-yt-paper-tooltip #tooltip');
            if (tooltip && tooltip.textContent) {
                const text = tooltip.textContent;
                consolelog('[Y2M Debug] Tooltip text:', text);
                const parts = text.split('•');
                if (parts.length >= 1) {
                    const viewPart = parts[0].trim();
                    const match = viewPart.match(/([\d,\.]+[KMB]?)\s+views/i);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
            }

            // Tertiary: Try aria-label (least reliable)
            const viewCountEl = document.querySelector('#info-container #view-count');
            if (viewCountEl) {
                const ariaLabel = viewCountEl.getAttribute('aria-label');
                consolelog('[Y2M Debug] aria-label:', ariaLabel);
                if (ariaLabel) {
                    const match = ariaLabel.match(/([\d,\.]+[KMB]?)\s+views/i);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
            }

            consolelog('[Y2M Debug] View count not found');
            return 'Unknown';
        }

        extractSubscriberCount() {
            const subCountEl = document.querySelector('#owner-sub-count');
            if (subCountEl) {
                const ariaLabel = subCountEl.getAttribute('aria-label');
                if (ariaLabel) {
                    const match = ariaLabel.match(/([\d,\.]+[KMB]?)\s*(thousand|million|billion)?/i);
                    if (match) {
                        let count = match[1];
                        if (match[2]) {
                            count += ' ' + match[2];
                        }
                        return count;
                    }
                }
                const text = subCountEl.textContent.trim();
                if (text && text !== 'Subscribe') {
                    return text;
                }
            }
            return 'Unknown';
        }

        extractLikeCount() {
            const likeBtn = document.querySelector('like-button-view-model .yt-spec-button-shape-next__button-text-content');
            if (likeBtn) {
                const text = likeBtn.textContent.trim();
                if (text && text.match(/[\d,\.]+[KMB]?/i)) {
                    return text;
                }
            }
            const likeBtnWrapper = document.querySelector('like-button-view-model button');
            if (likeBtnWrapper) {
                const ariaLabel = likeBtnWrapper.getAttribute('aria-label');
                if (ariaLabel) {
                    const match = ariaLabel.match(/([\d,\.]+[KMB]?)/i);
                    if (match) {
                        return match[1];
                    }
                }
            }
            return 'Unknown';
        }

        extractPublishDate() {
            // Primary: Check tooltip
            const tooltip = document.querySelector('#info-container + tp-yt-paper-tooltip #tooltip');
            if (tooltip && tooltip.textContent) {
                const text = tooltip.textContent;
                const parts = text.split('•');
                if (parts.length >= 2) {
                    const datePart = parts[1].trim();
                    const match = datePart.match(/([A-Z][a-z]+ \d+, \d{4})/);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
            }

            // Secondary: Check #info element
            const infoEl = document.querySelector('#info-container #info');
            if (infoEl && infoEl.textContent.trim()) {
                const text = infoEl.textContent.trim();
                const match = text.match(/([A-Z][a-z]+ \d+, \d{4})/);
                if (match && match[1]) {
                    return match[1];
                }
            }

            return new Date().toISOString().split('T')[0];
        }

        extractChapters() {
            const chapters = [];

            // Method 1: Extract from ytInitialData JSON (most reliable, synchronous)
            try {
                if (window.ytInitialData) {
                    const engagementPanels = window.ytInitialData.engagementPanels;
                    if (engagementPanels && engagementPanels.length > 0) {
                        // Find the chapters panel
                        const chaptersPanel = engagementPanels.find(panel =>
                                panel.engagementPanelSectionListRenderer?.panelIdentifier === 'engagement-panel-macro-markers-description-chapters');

                        if (chaptersPanel) {
                            const contents = chaptersPanel.engagementPanelSectionListRenderer
                                ?.content?.macroMarkersListRenderer?.contents;

                            if (contents && contents.length > 0) {
                                // Check if first item is auto-generated info (skip it if so)
                                const startIndex = contents[0].macroMarkersInfoItemRenderer ? 1 : 0;

                                for (let i = startIndex; i < contents.length; i++) {
                                    const chapter = contents[i].macroMarkersListItemRenderer;
                                    if (chapter) {
                                        const time = chapter.timeDescription?.simpleText || '';
                                        const title = chapter.title?.simpleText || '';

                                        if (time && title) {
                                            chapters.push({
                                                time,
                                                title
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                consolelog('[Y2M] Chapter extraction from ytInitialData failed:', e);
            }

            // Method 2: Fallback to ytInitialPlayerResponse
            if (chapters.length === 0 && window.ytInitialPlayerResponse) {
                try {
                    const markersMap = window.ytInitialPlayerResponse?.playerOverlays?.playerOverlayRenderer
                        ?.decoratedPlayerBarRenderer?.decoratedPlayerBarRenderer?.playerBar
                        ?.multiMarkersPlayerBarRenderer?.markersMap;

                    if (markersMap && markersMap.length > 0) {
                        const chaptersData = markersMap.find(m => m.key === 'DESCRIPTION_CHAPTERS');
                        if (chaptersData && chaptersData.value?.chapters) {
                            chaptersData.value.chapters.forEach(chapter => {
                                const time = this.formatChapterTime(chapter.chapterRenderer?.timeRangeStartMillis / 1000);
                                const title = chapter.chapterRenderer?.title?.simpleText;
                                if (time && title) {
                                    chapters.push({
                                        time,
                                        title
                                    });
                                }
                            });
                        }
                    }
                } catch (e) {
                    consolelog('[Y2M] Chapter extraction from playerResponse failed:', e);
                }
            }

            // Method 3: Fallback to DOM extraction (least reliable)
            if (chapters.length === 0) {
                const chapterElements = document.querySelectorAll('ytd-macro-markers-list-renderer ytd-macro-markers-list-item-renderer');
                chapterElements.forEach(el => {
                    // Time is in #time div, NOT .timestamp
                    const time = el.querySelector('#time')?.textContent?.trim();
                    // Title is in .macro-markers, NOT .title
                    const title = el.querySelector('.macro-markers')?.textContent?.trim();
                    if (time && title) {
                        chapters.push({
                            time,
                            title
                        });
                    }
                });
            }

            consolelog('[Y2M] Extracted chapters:', chapters.length);
            return chapters;
        }

        // Add this helper method to convert milliseconds to M:SS format
        formatChapterTime(seconds) {
            if (!seconds || isNaN(seconds))
                return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        extractCategory() {
            try {
                if (window.ytInitialPlayerResponse) {
                    const category = window.ytInitialPlayerResponse?.videoDetails?.category;
                    if (category)
                        return category;
                    const microformatCategory = window.ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer?.category;
                    if (microformatCategory)
                        return microformatCategory;
                }
                if (window.ytInitialData) {
                    const category = window.ytInitialData?.videoDetails?.category;
                    if (category)
                        return category;
                }
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    const text = script.textContent || '';
                    if (text.includes('"category"')) {
                        const match = text.match(/"category"\s*:\s*"([^"]+)"/);
                        if (match && match[1]) {
                            return match[1];
                        }
                    }
                }
            } catch (e) {
                consolelog('[Y2M] CategoryExtractor: Failed to extract category', e);
            }
            return 'Uncategorized';
        }

        getCategorySlug(category) {
            if (!category || category === 'Uncategorized')
                return 'Uncategorized';
            const appConfig = ConfigManager.getAppConfig();
            if (appConfig.customCategoryMap && appConfig.customCategoryMap[category]) {
                return appConfig.customCategoryMap[category];
            }
            return category
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '-')
            .replace(/&/g, 'and')
            .toLowerCase()
            .substring(0, 30);
        }
    }

    // --- Transcript Extractor ---
    class TranscriptExtractor {
        extractCaptionTrackUrl() {
            try {
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    const text = script.textContent || '';
                    if (text.includes('captionTracks')) {
                        const match = text.match(/"captionTracks":(\[.*?\])/);
                        if (match) {
                            const tracks = JSON.parse(match[1]);
                            if (tracks && tracks.length > 0) {
                                const englishTrack = tracks.find(t => t.languageCode === 'en');
                                return (englishTrack || tracks[0]).baseUrl;
                            }
                        }
                    }
                }
                if (window.ytInitialPlayerResponse) {
                    const tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    if (tracks && tracks.length > 0) {
                        const englishTrack = tracks.find(t => t.languageCode === 'en');
                        return (englishTrack || tracks[0]).baseUrl;
                    }
                }
            } catch (e) {
                consolelog('[Y2M] TranscriptExtractor: Failed to extract caption URL', e);
            }
            return null;
        }

        async extractTranscriptFromDOM() {
            return new Promise((resolve) => {
                const buttons = [
                    'button[aria-label="Show transcript"]',
                    'ytd-video-description-transcript-section-renderer #primary-button button'
                ];
                let transcriptButton = null;
                for (const selector of buttons) {
                    transcriptButton = document.querySelector(selector);
                    if (transcriptButton)
                        break;
                }
                if (!transcriptButton) {
                    resolve(null);
                    return;
                }
                transcriptButton.click();
                setTimeout(() => {
                    const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
                    if (segments.length === 0) {
                        resolve(null);
                        return;
                    }
                    // Extract transcript WITH timestamps from DOM
                    const transcript = Array.from(segments)
                        .map(segment => {
                            const timestamp = segment.querySelector('.segment-timestamp')?.textContent?.trim() || '';
                            const text = segment.querySelector('yt-formatted-string')?.textContent?.trim() || '';
                            if (timestamp && text) {
                                return `[${timestamp}] ${text}`;
                            }
                            return text;
                        })
                        .filter(t => t)
                        .join('\n');
                    resolve(transcript.trim() || null);
                }, 2500);
            });
        }

        async getTranscript() {
            var transcript = await this.extractTranscriptFromDOM();
            return transcript;
        }
    }

    // --- Settings Manager ---
    class SettingsManager {
        constructor(serverManager) {
            this.serverManager = serverManager;
            this.settingsModal = null;
        }

        openSettings() {
            consolelog('[Y2M Settings] openSettings() called');
            if (this.settingsModal && document.body.contains(this.settingsModal)) {
                this.settingsModal.style.display = 'flex';
                return;
            } else {
                this.settingsModal = null;
            }
            const existingModal = document.getElementById('yto-settings-modal');
            if (existingModal) {
                existingModal.remove();
            }
            const serverConfig = this.serverManager.getConfig();
            const appConfig = ConfigManager.getAppConfig();
            const overlay = document.createElement('div');
            overlay.id = 'yto-settings-modal';
            const panel = document.createElement('div');
            panel.id = 'yto-settings-panel';
            const title = document.createElement('h3');
            title.textContent = 'Settings';
            panel.appendChild(title);
            const tabContainer = document.createElement('div');
            tabContainer.className = 'tab-container';
            const tabs = [{
                    id: 'server',
                    label: 'Server'
                }, {
                    id: 'app',
                    label: 'App'
                }, {
                    id: 'categories',
                    label: 'Categories'
                }
            ];
            tabs.forEach((tab, index) => {
                const tabEl = document.createElement('div');
                tabEl.className = 'tab' + (index === 0 ? ' active' : '');
                tabEl.dataset.tab = tab.id;
                tabEl.textContent = tab.label;
                tabEl.onclick = () => {
                    panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    tabEl.classList.add('active');
                    panel.querySelector(`#tab-${tab.id}`).classList.add('active');
                };
                tabContainer.appendChild(tabEl);
            });
            panel.appendChild(tabContainer);
            const serverTab = document.createElement('div');
            serverTab.id = 'tab-server';
            serverTab.className = 'tab-content active';
            const serverCheckboxGroup = document.createElement('div');
            serverCheckboxGroup.className = 'checkbox-group';
            const serverCheckbox = document.createElement('input');
            serverCheckbox.type = 'checkbox';
            serverCheckbox.id = 'yto-server-enabled';
            serverCheckbox.checked = serverConfig.enabled;
            const serverLabel = document.createElement('label');
            serverLabel.htmlFor = 'yto-server-enabled';
            serverLabel.textContent = 'Enable Local File Server';
            serverCheckboxGroup.appendChild(serverCheckbox);
            serverCheckboxGroup.appendChild(serverLabel);
            serverTab.appendChild(serverCheckboxGroup);
            const serverFields = [{
                    id: 'yto-server-host',
                    label: 'Host',
                    value: serverConfig.host,
                    type: 'text'
                }, {
                    id: 'yto-server-port',
                    label: 'Port',
                    value: serverConfig.port,
                    type: 'number'
                }, {
                    id: 'yto-server-vault',
                    label: 'Vault Name',
                    value: serverConfig.vaultName,
                    type: 'text'
                }, {
                    id: 'yto-server-basepath',
                    label: 'Base Path in Vault',
                    value: serverConfig.basePath,
                    type: 'text'
                }
            ];
            serverFields.forEach(field => {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                const label = document.createElement('label');
                label.textContent = field.label;
                const input = document.createElement('input');
                input.type = field.type;
                input.id = field.id;
                input.value = field.value;
                formGroup.appendChild(label);
                formGroup.appendChild(input);
                serverTab.appendChild(formGroup);
            });
            panel.appendChild(serverTab);
            const appTab = document.createElement('div');
            appTab.id = 'tab-app';
            appTab.className = 'tab-content';
            const appCheckboxGroups = [{
                    id: 'yto-use-category-folders',
                    label: 'Use Category Folders',
                    checked: appConfig.useCategoryFolders
                }, {
                    id: 'yto-include-category-frontmatter',
                    label: 'Include Category in Frontmatter',
                    checked: appConfig.includeCategoryInFrontmatter
                }
            ];
            appCheckboxGroups.forEach(group => {
                const checkboxGroup = document.createElement('div');
                checkboxGroup.className = 'checkbox-group';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = group.id;
                checkbox.checked = group.checked;
                const label = document.createElement('label');
                label.htmlFor = group.id;
                label.textContent = group.label;
                checkboxGroup.appendChild(checkbox);
                checkboxGroup.appendChild(label);
                appTab.appendChild(checkboxGroup);
            });
            panel.appendChild(appTab);
            const categoriesTab = document.createElement('div');
            categoriesTab.id = 'tab-categories';
            categoriesTab.className = 'tab-content';
            const catLabel = document.createElement('label');
            catLabel.textContent = 'Custom Category Mappings (YouTube Category ' + ICONS.ARROW + ' Folder Name)';
            categoriesTab.appendChild(catLabel);
            const mappingsContainer = document.createElement('div');
            mappingsContainer.id = 'yto-category-mappings';
            categoriesTab.appendChild(mappingsContainer);
            const addMappingBtn = document.createElement('button');
            addMappingBtn.id = 'yto-add-category-mapping';
            addMappingBtn.textContent = '+ Add Mapping';
            addMappingBtn.style.cssText = 'margin-top:10px;background:#3ea6ff;color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;';
            categoriesTab.appendChild(addMappingBtn);
            const helpDiv = document.createElement('div');
            helpDiv.style.cssText = 'margin-top:15px;font-size:12px;color:#888;';
            const helpPara = document.createElement('p');
            helpPara.style.margin = '0 0 5px 0';
            helpPara.textContent = 'Examples:';
            helpDiv.appendChild(helpPara);
            const helpList = document.createElement('ul');
            helpList.style.margin = '0';
            helpList.style.paddingLeft = '20px';
            const examples = [{
                    from: '"Science & Technology"',
                    to: '"science"'
                }, {
                    from: '"Howto & Style"',
                    to: '"tutorials"'
                }, {
                    from: '"Entertainment"',
                    to: '"media"'
                }
            ];
            examples.forEach(ex => {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '3px';
                listItem.textContent = ex.from + ' ' + ICONS.ARROW + ' ' + ex.to;
                helpList.appendChild(listItem);
            });
            helpDiv.appendChild(helpList);
            categoriesTab.appendChild(helpDiv);
            panel.appendChild(categoriesTab);
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'margin-top:20px;display:flex;justify-content:flex-end;gap:10px;';
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'yto-settings-cancel';
            cancelBtn.textContent = 'Cancel';
            actionsDiv.appendChild(cancelBtn);
            const saveBtn = document.createElement('button');
            saveBtn.id = 'yto-settings-save';
            saveBtn.textContent = 'Save Settings';
            actionsDiv.appendChild(saveBtn);
            panel.appendChild(actionsDiv);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
            this.settingsModal = overlay;
            this.renderCategoryMappings(appConfig.customCategoryMap || {});
            addMappingBtn.onclick = () => {
                this.addCategoryMappingRow();
            };
            cancelBtn.onclick = () => this.closeSettings();
            saveBtn.onclick = () => this.saveSettings();
            overlay.onclick = (e) => {
                if (e.target === overlay)
                    this.closeSettings();
            };
            overlay.style.display = 'flex';
            consolelog('[Y2M Settings] Modal displayed');
        }

        renderCategoryMappings(mappings) {
            const container = document.getElementById('yto-category-mappings');
            if (!container)
                return;
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            Object.entries(mappings).forEach(([category, folder]) => {
                this.addCategoryMappingRow(category, folder);
            });
            if (Object.keys(mappings).length === 0) {
                const defaultMsg = document.createElement('div');
                defaultMsg.style.cssText = 'color:#888;font-size:12px;padding:10px;';
                defaultMsg.textContent = 'No custom mappings. Categories will use default folder names.';
                container.appendChild(defaultMsg);
            }
        }

        addCategoryMappingRow(category = '', folder = '') {
            const container = document.getElementById('yto-category-mappings');
            if (!container)
                return;
            const defaultMsg = container.querySelector('div[style*="color:#888"]');
            if (defaultMsg)
                defaultMsg.remove();
            const row = document.createElement('div');
            row.className = 'yto-category-mapping-row';
            const catInput = document.createElement('input');
            catInput.type = 'text';
            catInput.placeholder = 'YouTube Category (e.g., Science & Technology)';
            catInput.value = category;
            catInput.className = 'yto-mapping-category';
            const folderInput = document.createElement('input');
            folderInput.type = 'text';
            folderInput.placeholder = 'Folder Name (e.g., science)';
            folderInput.value = folder;
            folderInput.className = 'yto-mapping-folder';
            const removeBtn = document.createElement('button');
            removeBtn.textContent = ICONS.CROSS;
            removeBtn.className = 'yto-remove-mapping';
            removeBtn.onclick = () => {
                row.remove();
                if (container.children.length === 0) {
                    const defaultMsg = document.createElement('div');
                    defaultMsg.style.cssText = 'color:#888;font-size:12px;padding:10px;';
                    defaultMsg.textContent = 'No custom mappings. Categories will use default folder names.';
                    container.appendChild(defaultMsg);
                }
            };
            row.appendChild(catInput);
            row.appendChild(folderInput);
            row.appendChild(removeBtn);
            container.appendChild(row);
        }

        closeSettings() {
            if (this.settingsModal) {
                this.settingsModal.style.display = 'none';
            }
        }

        saveSettings() {
            const panel = document.getElementById('yto-settings-panel');
            if (!panel)
                return;
            const newServerConfig = {
                enabled: panel.querySelector('#yto-server-enabled').checked,
                host: panel.querySelector('#yto-server-host').value.trim(),
                port: panel.querySelector('#yto-server-port').value.trim(),
                vaultName: panel.querySelector('#yto-server-vault').value.trim(),
                basePath: panel.querySelector('#yto-server-basepath').value.trim()
            };
            this.serverManager.saveConfig(newServerConfig);
            const customCategoryMap = {};
            panel.querySelectorAll('.yto-category-mapping-row').forEach(row => {
                const category = row.querySelector('.yto-mapping-category').value.trim();
                const folder = row.querySelector('.yto-mapping-folder').value.trim();
                if (category && folder) {
                    customCategoryMap[category] = folder;
                }
            });
            const newAppConfig = {
                useCategoryFolders: panel.querySelector('#yto-use-category-folders').checked,
                includeCategoryInFrontmatter: panel.querySelector('#yto-include-category-frontmatter').checked,
                customCategoryMap: customCategoryMap
            };
            ConfigManager.saveAppConfig(newAppConfig);
            this.closeSettings();
            GM_notification({
                text: 'Settings saved successfully',
                title: 'YouTube to Markdown',
                timeout: 3000
            });
        }
    }

    // --- UI Manager ---
    class UIManager {
        constructor(extractor, transcriptExtractor, serverManager) {
            this.extractor = extractor;
            this.transcriptExtractor = transcriptExtractor;
            this.serverManager = serverManager;
            this.settingsManager = new SettingsManager(serverManager);
            this.modal = null;
            this.serverStatus = null;
            this.buttonInitialized = false;
            this.createServerStatusButton();
            this.initButton();
            this.updateServerStatus();
        }

        createServerStatusButton() {
            const existingStatus = document.getElementById('yto-server-status');
            if (existingStatus) {
                existingStatus.remove();
            }
            const statusBtn = document.createElement('button');
            statusBtn.id = 'yto-server-status';
            statusBtn.style.cssText = 'position:fixed;top:10px;left:300px;z-index:9997;padding:6px 12px;border:none;border-radius:4px;font-size:11px;cursor:pointer;';
            statusBtn.onclick = () => this.settingsManager.openSettings();
            document.body.appendChild(statusBtn);
            this.serverStatus = statusBtn;
            this.updateServerStatus();
        }

        async updateServerStatus() {
            const statusEl = document.getElementById('yto-server-status');
            if (!statusEl)
                return;
            const config = this.serverManager.getConfig();
            if (!config.enabled) {
                statusEl.className = 'yto-server-status offline';
                statusEl.textContent = 'Server Disabled';
                return;
            }
            const online = await this.serverManager.checkConnection();
            if (online) {
                statusEl.className = 'yto-server-status online';
                statusEl.textContent = 'Server Online';
            } else {
                statusEl.className = 'yto-server-status offline';
                statusEl.textContent = 'Server Offline';
            }
        }

        initButton() {
            consolelog("[Y2M] Initing Button")
            if (this.buttonInitialized)
                return;
            this.buttonInitialized = true;
            let debounceTimer = null;
            const observer = new MutationObserver(() => {
                if (debounceTimer)
                    clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const menu = document.querySelector('#top-level-buttons-computed');
                    const btn = document.getElementById('yto-y2mmarkdown-btn');
                    if (menu && !btn) {
                        this.createButton(menu);
                    }
                }, 200);
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            // Store reference for cleanup
            __Y2M_OBSERVER = observer;
        }

        async createButton(container) {
            const existingBtn = document.getElementById('yto-y2mmarkdown-btn');
            if (existingBtn) {
                existingBtn.remove();
                consolelog("[Y2M] removing existing button")
            }
            const btn = document.createElement('button');
            btn.id = 'yto-y2mmarkdown-btn';
            const videoId = this.extractor.getVideoId();
            const category = this.extractor.extractCategory();
            const channel = this.extractor.extractChannel();
            let fileExists = false;
            let existingFilename = null;
            const config = this.serverManager.getConfig();

            const appConfig = ConfigManager.getAppConfig();
            if (appConfig.useCategoryFolders && category && category !== 'Uncategorized') {
                const badge = document.createElement('span');
                badge.className = 'yto-category-badge';
                badge.textContent = category;
                btn.appendChild(badge);
            }

            if (!config.enabled) {
                const savedData = StorageManager.getVideoData(videoId);
                if (savedData && savedData.filename) {
                    fileExists = await this.serverManager.fileExists(savedData.filename);
                    existingFilename = savedData.filename;
                }
            } else {
                let folderPath = '';
                if (appConfig.useCategoryFolders && category && category !== 'Uncategorized') {
                    const categorySlug = this.extractor.getCategorySlug(category);
                    folderPath = `${categorySlug}/`;
                }
                var fn = this.generateFilename({
                    id: videoId,
                    channel: channel,
                    title: this.extractor.extractTitle()
                }, folderPath)
                    consolelog("[Y2M] createButton filename " + fn)

                    if (await this.serverManager.checkConnection() && await this.serverManager.fileExists(fn)) {
                        fileExists = true
                    }
            }

            if (fileExists) {
                btn.classList.add('exists');
                btn.textContent = ICONS.EDIT + ' Edit Note';
            } else {
                btn.textContent = ICONS.SAVE + ' Save to Markdown';
            }

            btn.onclick = () => this.openModal(existingFilename, category);
            container.appendChild(btn);
        }

        async openModal(existingFilename = null, category = 'Uncategorized') {
            const existingOverlay = document.getElementById('yto-modal-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            if (this.modal) {
                this.modal = null;
            }
            const videoId = this.extractor.getVideoId();
            const name = this.extractor.extractChannel();
            const serverEnabled = this.serverManager.getConfig().enabled;
            const appConfig = ConfigManager.getAppConfig();
            var fileExists = !!existingFilename; {
                let folderPath = '';
                if (appConfig.useCategoryFolders && category && category !== 'Uncategorized') {
                    const categorySlug = this.extractor.getCategorySlug(category);
                    folderPath = `${categorySlug}/`;
                }
                var fn = this.generateFilename({
                    id: videoId,
                    channel: name,
                    title: this.extractor.extractTitle()
                }, folderPath)

                    if (await this.serverManager.checkConnection() && await this.serverManager.fileExists(fn)) {
                        fileExists = true
                            existingFilename = fn
                    }
            }

            const overlay = document.createElement('div');
            overlay.id = 'yto-modal-overlay';
            const modal = document.createElement('div');
            modal.id = 'yto-modal';
            const title = document.createElement('h2');
            title.textContent = fileExists ? 'Update Markdown Note' : 'Save to File';
            modal.appendChild(title);
            const categoryDiv = document.createElement('div');
            categoryDiv.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:10px;';
            const categoryLabel = document.createElement('span');
            categoryLabel.textContent = 'Category: ';
            categoryDiv.appendChild(categoryLabel);
            const categoryStrong = document.createElement('strong');
            categoryStrong.style.color = '#6f42c1';
            categoryStrong.textContent = category;
            categoryDiv.appendChild(categoryStrong);
            if (appConfig.useCategoryFolders) {
                const arrowSpan = document.createElement('span');
                arrowSpan.style.marginLeft = '10px';
                arrowSpan.textContent = ICONS.ARROW + ' Folder: ';
                categoryDiv.appendChild(arrowSpan);
                const folderStrong = document.createElement('strong');
                folderStrong.style.color = '#3ea6ff';
                folderStrong.textContent = this.extractor.getCategorySlug(category);
                categoryDiv.appendChild(folderStrong);
            }
            modal.appendChild(categoryDiv);
            const serverStatusDiv = document.createElement('div');
            serverStatusDiv.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:10px;';
            const serverStatusSpan = document.createElement('span');
            serverStatusSpan.id = 'yto-modal-server-status';
            serverStatusSpan.textContent = `Server: ${serverEnabled ? 'Checking...' : 'Disabled'}`;
            serverStatusDiv.appendChild(serverStatusSpan);
            if (serverEnabled) {
                const fileStatusSpan = document.createElement('span');
                fileStatusSpan.id = 'yto-file-status';
                serverStatusDiv.appendChild(fileStatusSpan);
            }
            modal.appendChild(serverStatusDiv);
            const infoDiv = document.createElement('div');
            infoDiv.id = 'yto-info';
            infoDiv.style.fontSize = '13px';
            infoDiv.style.color = '#ccc';
            modal.appendChild(infoDiv);
            const videoTitle = this.extractor.extractTitle();
            const channel = this.extractor.extractChannel();
            infoDiv.textContent = `${videoTitle} by ${channel}`;
            if (fileExists) {
                const noticeDiv = document.createElement('div');
                noticeDiv.className = 'yto-file-exists-notice';
                noticeDiv.textContent = ICONS.CHECK + ' This note already exists. Your changes will update the existing file.';
                modal.appendChild(noticeDiv);
            }
            const notesLabel = document.createElement('label');
            notesLabel.textContent = 'User Notes';
            modal.appendChild(notesLabel);
            const notesTextarea = document.createElement('textarea');
            notesTextarea.id = 'yto-notes';
            notesTextarea.placeholder = 'Add your personal thoughts here...';
            if (fileExists && serverEnabled) {
                notesTextarea.value = '';
            }
            modal.appendChild(notesTextarea);
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'yto-option-group';
            const options = [{
                    id: 'yto-transcript',
                    label: 'Include Transcript',
                    checked: true
                }, {
                    id: 'yto-chapters',
                    label: 'Include Chapters',
                    checked: true
                }, {
                    id: 'yto-metadata',
                    label: 'Include Metadata (views, date)',
                    checked: true
                }, {
                    id: 'yto-thumbnail',
                    label: 'Include Thumbnail Link',
                    checked: true
                }, {
                    id: 'yto-category-folder',
                    label: `Use Category Folder (${category})`,
                    checked: appConfig.useCategoryFolders
                }
            ];
            options.forEach(opt => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = opt.id;
                if (opt.checked)
                    checkbox.checked = true;
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(' ' + opt.label));
                optionsDiv.appendChild(label);
            });
            modal.appendChild(optionsDiv);
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            const checkboxLabel = document.createElement('label');
            checkboxLabel.style.display = 'flex';
            checkboxLabel.style.alignItems = 'center';
            checkboxLabel.style.gap = '5px';
            checkboxLabel.style.cursor = 'pointer';
            const clipboardCheckbox = document.createElement('input');
            clipboardCheckbox.type = 'checkbox';
            clipboardCheckbox.id = 'yto-clipboard';
            checkboxLabel.appendChild(clipboardCheckbox);
            checkboxLabel.appendChild(document.createTextNode(' Copy to Clipboard (instead of download/server)'));
            rowDiv.appendChild(checkboxLabel);
            const statusSpan = document.createElement('span');
            statusSpan.id = 'yto-status';
            statusSpan.style.fontSize = '12px';
            statusSpan.style.color = '#aaa';
            rowDiv.appendChild(statusSpan);
            modal.appendChild(rowDiv);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';

            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'yto-btn-settings';
            settingsBtn.textContent = ICONS.SETTINGS + ' Settings';
            settingsBtn.onclick = () => this.settingsManager.openSettings();
            actionsDiv.appendChild(settingsBtn);

            const editBtn = document.createElement('button');
            if (fileExists && serverEnabled) {
                editBtn.id = 'yto-btn-action';
                editBtn.textContent = 'Edit Note';
                actionsDiv.appendChild(editBtn);
            }

            const actionBtn = document.createElement('button');
            actionBtn.id = 'yto-btn-action';
            actionBtn.textContent = fileExists ? 'Update Note' : 'Save';
            actionsDiv.appendChild(actionBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'yto-btn-cancel';
            cancelBtn.textContent = 'Cancel';
            actionsDiv.appendChild(cancelBtn);

            modal.appendChild(actionsDiv);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            this.modal = overlay;
            overlay.style.display = 'flex';
            cancelBtn.onclick = () => this.closeModal();
            actionBtn.onclick = () => this.processSave(videoId, fileExists, existingFilename, category);
            editBtn.onclick = () => this.processEdit(existingFilename, category);
            overlay.onclick = (e) => {
                if (e.target === overlay)
                    this.closeModal();
            };

            if (serverEnabled) {
                const online = await this.serverManager.checkConnection();
                const serverStatusEl = document.getElementById('yto-modal-server-status');
                if (serverStatusEl) {
                    serverStatusEl.textContent = `Server: ${online ? 'Online ' + ICONS.CHECK : 'Offline ' + ICONS.CROSS}`;
                    serverStatusEl.style.color = online ? '#2ea043' : '#ff4444';
                }
                consolelog("[Y2M] online = " + online)

                if (fileExists && online) {
                    consolelog("[Y2M] Reading file " + existingFilename)
                    const existingContent = await this.serverManager.readFile(existingFilename);
                    if (existingContent) {
                        // Extract User Notes
                        const notesMatch = existingContent.match(/## User Notes\s*([\s\S]*?)(?=##|\-\-\-|$)/);
                        if (notesMatch && notesMatch[1]) {
                            const notes = notesMatch[1].trim();
                            notesTextarea.value = notes === '*No notes added*' ? '' : notes;
                        }

                        // Extract and parse Metrics History Table - STORE IT
                        const existingMetrics = this.parseMetricsHistoryTable(existingContent);
                        consolelog("[Y2M] Parsed existing metrics:", existingMetrics.length, "rows");

                        // Extract Transcript - STORE IT for reuse
                        const existingTranscript = this.parseTranscript(existingContent);
                        consolelog("[Y2M] Existing transcript length:", existingTranscript ? existingTranscript.length : 0);

                        // Store all existing data for processSave
                        this.existingData = {
                            content: existingContent,
                            metrics: existingMetrics,
                            transcript: existingTranscript,
                            chapters: this.parseChapters(existingContent)
                        };

                        // Check existing options and set checkboxes
                        const hasTranscript = existingContent.includes('## Transcript');
                        const transBox = document.getElementById('yto-transcript');
                        if (transBox)
                            transBox.checked = hasTranscript;

                        const hasChapters = existingContent.includes('## Chapters');
                        const chapBox = document.getElementById('yto-chapters');
                        if (chapBox)
                            chapBox.checked = hasChapters;

                        const hasMetadata = existingContent.includes('view_count:');
                        const metaBox = document.getElementById('yto-metadata');
                        if (metaBox)
                            metaBox.checked = hasMetadata;

                        const hasThumbnail = existingContent.includes('thumbnail:');
                        const thumbBox = document.getElementById('yto-thumbnail');
                        if (thumbBox)
                            thumbBox.checked = hasThumbnail;

                        consolelog("[Y2M] User Notes " + notesMatch)
                    }
                } else if (fileExists && !online) {
                    notesTextarea.value = 'Server offline - cannot load existing notes.';
                }
            }
        }

        closeModal() {
            if (this.modal) {
                this.modal.style.display = 'none';
            }
        }

        parseChapters(content) {
            const chapters = [];
            const chaptersMatch = content.match(/## Chapters\s*([\s\S]*?)(?=##|\-\-\-|$)/);
            if (chaptersMatch && chaptersMatch[1]) {
                const lines = chaptersMatch[1].trim().split('\n');
                lines.forEach(line => {
                    const match = line.match(/-\s*\*\*([^*]+)\*\*\s*(.+)/);
                    if (match && match[1] && match[2]) {
                        chapters.push({
                            time: match[1].trim(),
                            title: match[2].trim()
                        });
                    }
                });
            }
            return chapters;
        }

        parseMetricsHistoryTable(content) {
            const history = [];
            // Fix: Use \s* to match any whitespace (including multiple newlines)
            const tableMatch = content.match(/## Metrics History\s*(.*)\s*---/s);
            consolelog("[Y2M] tableMatch ", tableMatch)
            if (!tableMatch)
                return history;

            const tableContent = tableMatch[1].trim();
            consolelog("[Y2M Parse] Table content:", tableContent);

            // Split by newlines and filter for table rows
            const rows = tableContent.split('\n').filter(line => line.trim().startsWith('|'));
            consolelog("[Y2M Parse] Found rows:", rows.length);

            // Skip header and separator rows (first 2 rows)
            for (let i = 2; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row || row.startsWith('|---'))
                    continue;

                // Parse table row: | date | subs | views | likes |
                const cells = row.split('|').map(c => c.trim()).filter(c => c);
                consolelog("[Y2M Parse] Row cells:", cells);

                if (cells.length >= 4) {
                    const [date, subscribers, views, likes] = cells;
                    if (date && subscribers && views && likes) {
                        history.push({
                            date,
                            subscribers,
                            views,
                            likes
                        });
                    }
                }
            }
            consolelog("[Y2M Parse] Parsed metrics:", history);
            return history;
        }

        parseTranscript(content) {
            const transcriptMatch = content.match(/## Transcript\s*\n```\s*([\s\S]*?)\s*```/);

            if (transcriptMatch && transcriptMatch[1]) {
                return transcriptMatch[1].trim().replace(/\u00A0/g, '');
            }
            return null;
        }

        parseUserNotes(content) {
            const notesMatch = content.match(/## User Notes\s*([\s\S]*?)(?=##|\-\-\-|$)/);
            if (notesMatch && notesMatch[1]) {
                const notes = notesMatch[1].trim();
                return notes === '*No notes added*' ? '' : notes;
            }
            return '';
        }

        parseExistingOptions(content) {
            return {
                hasTranscript: content.includes('## Transcript'),
                hasChapters: content.includes('## Chapters'),
                hasMetadata: content.includes('view_count:'),
                hasThumbnail: content.includes('thumbnail:')
            };
        }

        async processEdit(existingFilename, category) {
            consolelog('[Y2M Process] Editing file:', existingFilename);
            let saveSuccess = await this.serverManager.editFile(existingFilename);
        }

        async processSave(videoId, fileExists, existingFilename, category) {
            const actionBtn = document.getElementById('yto-btn-action');
            const statusSpan = document.getElementById('yto-status');
            const includeTranscript = document.getElementById('yto-transcript').checked;
            const includeChapters = document.getElementById('yto-chapters').checked;
            const includeMetadata = document.getElementById('yto-metadata').checked;
            const includeThumbnail = document.getElementById('yto-thumbnail').checked;
            const useCategoryFolder = document.getElementById('yto-category-folder').checked;
            const copyToClipboard = document.getElementById('yto-clipboard').checked;
            const userNotes = document.getElementById('yto-notes').value;
            const serverEnabled = this.serverManager.getConfig().enabled;
            const appConfig = ConfigManager.getAppConfig();

            consolelog('[Y2M Process] serverEnabled:', serverEnabled);
            consolelog('[Y2M Process] fileExists:', fileExists);

            actionBtn.disabled = true;
            actionBtn.textContent = 'Processing...';
            statusSpan.textContent = '';

            try {
                await this.extractor.waitForElements();
                const description = await this.extractor.extractDescription();
                const videoData = {
                    id: videoId,
                    title: this.extractor.extractTitle(),
                    channel: this.extractor.extractChannel(),
                    category: category,
                    description: description,
                    viewCount: this.extractor.extractViewCount(),
                    subscriberCount: this.extractor.extractSubscriberCount(),
                    likeCount: this.extractor.extractLikeCount(),
                    publishDate: this.extractor.extractPublishDate(),
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    userNotes: userNotes
                };

                consolelog('[Y2M Process] Extracted metrics:', {
                    views: videoData.viewCount,
                    subs: videoData.subscriberCount,
                    likes: videoData.likeCount
                });

                let transcriptText = '';
                if (includeTranscript) {
                    // First check if we have existing transcript to reuse
                    if (this.existingData && this.existingData.transcript) {
                        consolelog('[Y2M Process] Reusing existing transcript');
                        transcriptText = this.existingData.transcript;
                    } else {
                        statusSpan.textContent = 'Fetching transcript...';
                        transcriptText = await this.transcriptExtractor.getTranscript();
                        if (!transcriptText) {
                            statusSpan.textContent = 'Transcript not available.';
                        }
                    }
                }

                let chapters = [];
                if (includeChapters) {
                    // First check if we have existing chapters to reuse
                    if (this.existingData && this.existingData.chapters && this.existingData.chapters.length > 0) {
                        consolelog('[Y2M Process] Reusing existing chapters');
                        chapters = this.existingData.chapters;
                    } else {
                        chapters = this.extractor.extractChapters();
                        consolelog('[Y2M Process] Extracted chapters:', chapters.length);
                    }
                }

                let existingContent = null;
                if (fileExists && serverEnabled) {
                    existingContent = await this.serverManager.readFile(existingFilename);
                }

                // For metrics history, combine existing + new
                let existingMetrics = [];
                if (this.existingData && this.existingData.metrics) {
                    existingMetrics = this.existingData.metrics;
                    consolelog("[Y2M] ExistingMetrics ", existingMetrics)
                }

                const markdown = this.generateMarkdown(videoData, transcriptText, chapters, {
                    includeMetadata,
                    includeThumbnail,
                    includeCategory: appConfig.includeCategoryInFrontmatter
                },
                        existingContent, existingMetrics);

                statusSpan.textContent = 'Generating file...';
                let folderPath = '';
                if (useCategoryFolder && appConfig.useCategoryFolders && category && category !== 'Uncategorized') {
                    const categorySlug = this.extractor.getCategorySlug(category);
                    folderPath = `${categorySlug}/`;
                }

                const filename = this.generateFilename(videoData, folderPath);
                let saveSuccess = false;

                if (copyToClipboard) {
                    GM_setClipboard(markdown);
                    statusSpan.textContent = ICONS.CHECK + ' Copied to clipboard!';
                    saveSuccess = true;
                } else if (serverEnabled) {
                    consolelog('[Y2M Process] Saving to server...');
                    statusSpan.textContent = fileExists ? 'Updating file on server...' : 'Saving to server...';
                    const targetFilename = existingFilename || filename;
                    saveSuccess = await this.serverManager.writeFile(targetFilename, markdown);
                    consolelog('[Y2M Process] Server save result:', saveSuccess);
                    if (saveSuccess) {
                        statusSpan.textContent = ICONS.CHECK + ' Saved to server!';
                    } else {
                        statusSpan.textContent = 'Server failed, downloading...';
                        this.downloadFile(markdown, filename);
                        saveSuccess = true;
                    }
                } else {
                    consolelog('[Y2M Process] Downloading (server disabled)...');
                    statusSpan.textContent = 'Downloading...';
                    this.downloadFile(markdown, filename);
                    saveSuccess = true;
                }

                if (saveSuccess && !serverEnabled) {
                    if (fileExists) {
                        StorageManager.updateVideo(videoData, existingFilename || filename);
                    } else {
                        StorageManager.markAsSaved(videoData, filename);
                    }
                }

                const mainBtn = document.getElementById('yto-y2mmarkdown-btn');
                if (mainBtn && saveSuccess) {
                    mainBtn.classList.add('exists');
                    mainBtn.textContent = ICONS.EDIT + ' Edit Note';
                }

                GM_notification({
                    text: fileExists ? 'Note updated successfully' : 'Note saved successfully',
                    title: 'YouTube to Markdown',
                    timeout: 3000
                });

                setTimeout(() => this.closeModal(), 1000);
            } catch (error) {
                console.error('[Y2M Process] Error:', error);
                statusSpan.textContent = 'Error: ' + error.message;
                statusSpan.style.color = '#ff4444';
            } finally {
                actionBtn.disabled = false;
                actionBtn.textContent = fileExists ? 'Update Note' : 'Save';
            }
        }

        centerString(str, totalLength, padChar = ' ') {
            const currentLength = str.length;
            const totalPadding = totalLength - currentLength;

            if (totalPadding <= 0) {
                return str; // Return original string if no padding is needed
            }

            const padLeft = Math.floor(totalPadding / 2);
            const padRight = totalPadding - padLeft;

            return padChar.repeat(padLeft) + str + padChar.repeat(padRight);
        }

        generateMarkdown(videoData, transcript, chapters, options, existingContent = null, existingMetrics = []) {
            //consolelog("[Y2M] chapters ", chapters)
            const escapeYaml = (text) => {
                if (!text)
                    return '';
                return text.replace(/"/g, '\\"').replace(/\n/g, ' ');
            };

            const today = new Date().toISOString().split('T')[0];
            const trackingEntry = `[${today}|${videoData.subscriberCount}|${videoData.viewCount}|${videoData.likeCount}]`;

            // Build tracking history from existing metrics + new entry
            let trackingHistory = [];

            consolelog("[Y2M] existing metrics ", existingMetrics)
            // Convert existing metrics table rows to tracking format
            existingMetrics.forEach(metric => {
                const entry = `[${metric.date}|${metric.subscribers}|${metric.views}|${metric.likes}]`;
                consolelog("[Y2M] combine metrics ", entry)
                if (!trackingHistory.includes(entry)) {
                    trackingHistory.push(entry);
                }
            });

            const isNewEntry = !trackingHistory.some(entry => entry.includes(today));
            if (isNewEntry) {
                trackingHistory.push(trackingEntry);
            }

            const trackingHistoryStr = trackingHistory.join(',\n');

            const categorySection = options.includeCategory && videoData.category ? `
category: "${escapeYaml(videoData.category)}"` : '';

            const metadataSection = options.includeMetadata ? `
view_count: ${videoData.viewCount}
subscriber_count: "${videoData.subscriberCount} subscribers"
like_count: "${videoData.likeCount}"
publish_date: "${videoData.publishDate}"` : '';

            const thumbnailSection = options.includeThumbnail ? `
thumbnail: 'https://i.ytimg.com/vi/${videoData.id}/maxresdefault.jpg'` : '';

            const chaptersSection = chapters.length > 0 ? `
## Chapters
${chapters.map(c => `- **${c.time}** ${c.title}`).join('\n')}
` : '';

            const transcriptSection = transcript ? `
## Transcript
\`\`\`
${transcript}
\`\`\`
` : '';

            const trackingTable = trackingHistory.length > 0 ? `
## Metrics History

|    Date    |   Subscribers   |    Views    |    Likes    |
|------------|-----------------|-------------|-------------|
${trackingHistory.map(entry => {
                    const parts = entry.match(/\[([\s\S]*?)\]/);
                    if (parts && parts[1]) {
                        const values = parts[1].split('|').map(v => v.trim());
                        if (values.length >= 4) {
                            return `|${this.centerString(values[0], 12)}|${this.centerString(values[1], 17)}|${this.centerString(values[2], 13)}|${this.centerString(values[3], 13)}|`;
                        }
                    }
                    return '';
                }).join('\n')}
` : '';

            return `
## Video Embed
![](${videoData.url})

## Title
${videoData.title}

## Description
${videoData.description}

## User Notes
${videoData.userNotes || '*No notes added*'}
${chaptersSection}
${trackingTable}
${transcriptSection}
---

## Metadata
\`\`\`
source: YouTube
channel: "${escapeYaml(videoData.channel)}"${categorySection}${metadataSection}${thumbnailSection}
url: ${videoData.url}
date_saved: "${today}"
tags: [youtube, ${escapeYaml(videoData.category).toLowerCase().replace(/\s+/g, '-')}]
\`\`\`
---

*Saved with YouTube to Markdown Userscript*`;

        }

        generateFilename(data, folderPath = '') {
            //console.log(data)
            var cleanTitle = data.title
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 100);

            cleanTitle = data.channel.substring(0, 50) + " - " + data.id + " - " + cleanTitle
                return `${folderPath}${cleanTitle}.md`;
        }

        downloadFile(content, filename) {
            const blob = new Blob([content], {
                type: 'text/markdown'
            });
            const url = URL.createObjectURL(blob);
            GM_download({
                url: url,
                name: filename,
                saveAs: true
            });
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    // --- Initialization ---
    function init() {
        consolelog('[Y2M] Checking for watch page...');
        if (!window.location.pathname.includes('/watch'))
            return;

        // Prevent multiple initializations
        if (__Y2M_INITIALIZED) {
            consolelog('[Y2M] Already initialized, skipping...');
            return;
        }
        __Y2M_INITIALIZED = true;

        // Clean up any existing elements first
        ['yto-y2mmarkdown-btn', 'yto-modal-overlay', 'yto-settings-modal', 'yto-server-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el)
                el.remove();
        });

        const extractor = new YouTubeDataExtractor();
        const transcriptExtractor = new TranscriptExtractor();
        const serverManager = new ServerManager();
        // Use the UIManager
        new UIManager(extractor, transcriptExtractor, serverManager);
    }

    // Run on load
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }

    // Handle YouTube's "Soft" navigation (yt-navigate-finish is the standard YT event)
    window.addEventListener('yt-navigate-finish', () => {
        consolelog('[Y2M] Navigation detected');
        // Reset initialization flag for new page
        __Y2M_INITIALIZED = false;

        // Clean up old UI elements before re-init
        ['yto-y2mmarkdown-btn', 'yto-modal-overlay', 'yto-settings-modal', 'yto-server-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el)
                el.remove();
        });

        // Clean up any existing observers
        if (__Y2M_OBSERVER) {
            __Y2M_OBSERVER.disconnect();
            __Y2M_OBSERVER = null;
        }

        init();
    });

})();
_addStyle(` 555; color: #fff; font-size: 12px; padding: 6px 12px; }
        #yto-btn-save:disabled, #yto-btn-update:disabled { background: #555; color: #888; cursor: not-allowed; }

        #yto-server-status {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
        }
        #yto-server-status.online { background: #2ea043; color: #fff; }
        #yto-server-status.offline { background: #ff4444; color: #fff; }

        .yto-option-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: #2a2a2a;
            border-radius: 4px;
        }
        .yto-option-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }
        .yto-option-group input[type="checkbox"] {
            width: 16px;
            height: 16px;
        }

        #yto-settings-modal {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #yto-settings-panel {
            background: #212121;
            color: #fff;
            width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            padding: 24px;
            border-radius: 8px;
            font-family: "Roboto", "Arial", sans-serif;
        }
        #yto-settings-panel h3 { margin-top: 0; color: #fff; }
        #yto-settings-panel .form-group {
            margin-bottom: 15px;
        }
        #yto-settings-panel label {
            display: block;
            margin-bottom: 5px;
            color: #aaa;
            font-size: 13px;
        }
        #yto-settings-panel input[type="text"],
        #yto-settings-panel input[type="number"] {
            width: 100%;
            padding: 8px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            border-radius: 4px;
            font-size: 14px;
        }
        #yto-settings-panel .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 15px;
        }
        #yto-settings-panel .checkbox-group input {
            width: 16px;
            height: 16px;
        }
        #yto-settings-panel .tab-container {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 10px;
        }
        #yto-settings-panel .tab {
            padding: 8px 16px;
            background: #333;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        #yto-settings-panel .tab.active {
            background: #3ea6ff;
            color: #000;
        }
        #yto-settings-panel .tab-content {
            display: none;
        }
        #yto-settings-panel .tab-content.active {
            display: block;
        }

        .yto-file-exists-notice {
            background: #2ea043;
            color: #fff;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            margin-bottom: 10px;
        }

        .yto-category-badge {
            background: #6f42c1;
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            display: inline-block;
            margin-left: 8px;
        }

        .yto-category-mapping-row {
            display: flex;
            gap: 10px;
            margin-bottom: 8px;
            align-items: center;
        }
        .yto-category-mapping-row input {
            flex: 1;
            padding: 6px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            border-radius: 4px;
            font-size: 12px;
        }
        .yto-category-mapping-row button {
          
        #yto-y2mmarkdown-btn {
            background-color: #cc0000;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 18px;
            font-weight: bold;
            cursor: pointer;
            font-family: "Roboto", "Arial", sans-serif;
            font-size: 14px;
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
            transition: background 0.2s;
        }
        #yto-y2mmarkdown-btn:hover { background-color: #ff0000; }
        #yto-y2mmarkdown-btn.exists { background-color: #2ea043; }
        #yto-y2mmarkdown-btn.exists:hover { background-color: #3fb950; }

        #yto-modal-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #yto-modal {
            background: #212121;
            color: #fff;
            width: 600px;
            max-width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            font-family: "Roboto", "Arial", sans-serif;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        #yto-modal h2 { margin-top: 0; font-size: 20px; color: #fff; }
        #yto-modal label { font-size: 14px; color: #aaa; }
        #yto-modal textarea {
            width: 100%;
            height: 200px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            padding: 10px;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
            font-size: 13px;
        }
        #yto-modal .row { display: flex; justify-content: space-between; align-items: center; }
        #yto-modal .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        #yto-modal button {
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }
        #yto-btn-cancel { background: #444; color: #fff; }
        #yto-btn-save { background: #3ea6ff; color: #000; }
        #yto-btn-update { background: #2ea043; color: #fff; }
        #yto-btn-settings { background: #
