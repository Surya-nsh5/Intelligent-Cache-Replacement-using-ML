document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const requestBtn = document.getElementById('request-btn');
    const pageInput = document.getElementById('page-request');
    const cacheContainer = document.getElementById('cache-memory');
    const cacheHitsSpan = document.getElementById('cache-hits');
    const cacheMissesSpan = document.getElementById('cache-misses');
    const hitRateSpan = document.getElementById('hit-rate');
    const logContainer = document.getElementById('simulation-log');
    const sizeInput = document.getElementById('size-input');
    const cacheSizeBadge = document.getElementById('cache-size-badge');

    // --- Cache State ---
    let CACHE_SIZE = 4;
    let cache = [];
    let cacheHistory = {};
    let hits = 0;
    let misses = 0;
    let isProcessing = false;

    /**
     * Handles the user's request to access a page.
     */
    async function handleRequest() {
        if (isProcessing) return;
        const pageId = pageInput.value.trim().toUpperCase();
        if (!pageId) return;

        isProcessing = true;
        clearHighlights();

        if (cache.includes(pageId)) {
            // --- CACHE HIT ---
            hits++;
            logMessage(`HIT: Page "${pageId}" found in cache.`, 'hit');
            updateHistory(pageId, true);
            highlightBlock(pageId, 'hit');
        } else {
            // --- CACHE MISS ---
            misses++;
            logMessage(`MISS: Page "${pageId}" not in cache.`, 'miss');
            let animationDelay = 0;

            if (cache.length >= CACHE_SIZE) {
                // Cache is full, need to evict
                const pageToEvict = await predictEviction();
                logMessage(`EVICT: Policy selected page "${pageToEvict}" for eviction.`, 'evict');

                highlightEvicted(pageToEvict);

                const evictIndex = cache.indexOf(pageToEvict);

                // Validation logic
                if (evictIndex >= 0) {
                    cache[evictIndex] = pageId;
                } else {
                    // Failsafe: The policy returned a page not in the cache.
                    const fallbackPage = cache[0];
                    logMessage(`WARN: Policy returned invalid page "${pageToEvict}". Evicting "${fallbackPage}" instead.`, 'evict');
                    highlightEvicted(fallbackPage);
                    cache[0] = pageId;
                }
                animationDelay = 300; // Wait for eviction animation
            } else {
                // Cache is not full, just add
                cache.push(pageId);
                logMessage(`ADD: Adding page "${pageId}" to cache.`, 'info');
            }

            updateHistory(pageId, false);

            setTimeout(() => {
                highlightBlock(pageId, 'miss');
            }, animationDelay);
        }

        // Update UI
        updateStatistics();
        pageInput.value = ''; // Clear input
        pageInput.focus();

        setTimeout(() => {
            isProcessing = false;
        }, 350);
    }

    /**
     * Predicts which page to evict based on the selected policy.
     */
    async function predictEviction() {
        // Get the selected policy from the dropdown
        const policy = document.getElementById('policy-select')?.value || 'LRU';

        if (policy === 'LRU') {
            return evictLRU();
        }
        if (policy === 'MRU') {
            return evictMRU();
        }

        if (policy === 'ML_SERVER') {
            logMessage("INFO: Requesting eviction from server...", 'info');
            try {
                // Prepare feature data for all cached pages
                const features = [];
                const pageIds = [];
                const now = Date.now();

                // compute recency ranks (1 = most recent)
                const pagesWithLast = cache.map(p => {
                    const s = cacheHistory[p] || { frequency: 0, lastUsed: 0 };
                    return { page: p, lastUsed: s.lastUsed || 0 };
                });
                // sort descending by lastUsed (recent first)
                pagesWithLast.sort((a, b) => b.lastUsed - a.lastUsed);
                const recencyRankMap = {};
                pagesWithLast.forEach((obj, idx) => {
                    recencyRankMap[obj.page] = idx + 1; 
                });

                for (const pageId of cache) {
                    const stats = cacheHistory[pageId] || { frequency: 0, lastUsed: 0 };
                    const last_access_time = now - (stats.lastUsed || now);
                    const access_count = stats.frequency || 0;
                    const recency_rank = recencyRankMap[pageId] || cache.length;
                    const access_type = (stats.access_type !== undefined) ? stats.access_type : 0; 
                    const cache_item = (() => {
                        const n = parseInt(pageId, 10);
                        if (!isNaN(n)) return n;
                        let h = 0;
                        for (let i = 0; i < pageId.length; i++) {
                            h = (h * 31 + pageId.charCodeAt(i)) >>> 0;
                        }
                        return h % 1000;
                    })();

                    features.push({
                        last_access_time,
                        access_count,
                        recency_rank,
                        access_type,
                        cache_item
                    });
                    pageIds.push(pageId);
                }

                // Send to Flask ML server
                const resp = await fetch('/predict-evict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pages: features, pageIds })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.evict) {
                        logMessage(`SERVER: ML model chose "${data.evict}".`, 'info');
                        return data.evict;
                    } else {
                        throw new Error('Server returned no eviction item');
                    }
                } else {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || 'Server responded poorly');
                }
            } catch (err) {
                console.warn('Server ML call failed, falling back to LFU', err);
                logMessage(`ERROR: Server call failed. Falling back to LFU.`, 'evict');
                return evictLFU(); // fallback method
            }
        }

        // Default fallback
        return evictLRU();
    }

    /**
     * Evicts Least Recently Used page.
     */
    function evictLRU() {
        let pageToEvict = null;
        let oldest = Infinity;
        for (const p of cache) {
            const s = cacheHistory[p] || { lastUsed: 0 };
            if (s.lastUsed < oldest) {
                oldest = s.lastUsed;
                pageToEvict = p;
            }
        }
        return pageToEvict || cache[0]; // Failsafe
    }

    /**
     * Evicts Most Recently Used page.
     */
    function evictMRU() {
        let pageToEvict = null;
        let newest = -Infinity;
        for (const p of cache) {
            const s = cacheHistory[p] || { lastUsed: 0 };
            if (s.lastUsed > newest) {
                newest = s.lastUsed;
                pageToEvict = p;
            }
        }
        return pageToEvict || cache[0]; // Failsafe
    }

    /**
     * Evicts Least Frequently Used page.
     * This is used as a fallback if the server call fails.
     */
    function evictLFU() {
        if (!cache || cache.length === 0) return null;

        let pageToEvict = null;
        let lowestFreq = Infinity;
        let oldestTime = Infinity;

        for (const pageId of cache) {
            const stats = cacheHistory[pageId] || { frequency: 0, lastUsed: 0 };

            if (stats.frequency < lowestFreq) {
                lowestFreq = stats.frequency;
                oldestTime = stats.lastUsed || 0;
                pageToEvict = pageId;
            } else if (stats.frequency === lowestFreq) {
                if ((stats.lastUsed || 0) < oldestTime) {
                    oldestTime = stats.lastUsed || 0;
                    pageToEvict = pageId;
                }
            }
        }
        logMessage(`LFU fallback evicted "${pageToEvict}"`, 'evict');
        return pageToEvict || cache[0]; // Failsafe
    }

    /**
     * Updates the history log for a page (our "model's" data).
     */
    function updateHistory(pageId, isHit) {
        if (!cacheHistory[pageId]) {
            cacheHistory[pageId] = { frequency: 0, lastUsed: 0 };
        }
        cacheHistory[pageId].frequency++;
        cacheHistory[pageId].lastUsed = Date.now();
    }

    // --- UI/Helper Functions (No changes below this line) ---

    function renderCache() {
        const slots = cacheContainer.querySelectorAll('.cache-slot');
        for (let i = 0; i < CACHE_SIZE; i++) {
            const slot = slots[i];
            if (!slot) continue;
            
            if (cache[i]) {
                if (slot.dataset.pageId !== cache[i]) {
                    slot.dataset.pageId = cache[i];
                    slot.innerHTML = `<span class="page-id">${cache[i]}</span>`;
                    slot.classList.remove('border-dashed', 'border-slate-700', 'bg-slate-800/50', 'text-slate-500');
                    slot.classList.add('filled');
                }
            } else {
                slot.removeAttribute('data-page-id');
                slot.innerHTML = `<span class="text-sm font-medium">Empty</span>`;
                slot.classList.add('border-dashed', 'border-slate-700', 'bg-slate-800/50', 'text-slate-500');
                slot.classList.remove('filled');
            }
        }
    }

    function updateStatistics() {
        const prevHits = cacheHitsSpan.textContent;
        const prevMisses = cacheMissesSpan.textContent;

        cacheHitsSpan.textContent = hits;
        cacheMissesSpan.textContent = misses;
        const total = hits + misses;
        const rate = (total === 0) ? 0 : (hits / total) * 100;
        const newRate = `${rate.toFixed(1)}%`;
        const prevRate = hitRateSpan.textContent;
        hitRateSpan.textContent = newRate;

        if (prevHits != hits) animateValue(cacheHitsSpan);
        if (prevMisses != misses) animateValue(cacheMissesSpan);
        if (prevRate != newRate) animateValue(hitRateSpan);
    }

    function animateValue(element) {
        element.classList.remove('value-updated');
        void element.offsetWidth; // trigger reflow
        element.classList.add('value-updated');
    }

    function logMessage(message, type = 'info') {
        const waitingMsg = logContainer.querySelector(".opacity-50");
        if (waitingMsg) {
            waitingMsg.remove();
        }
        
        const div = document.createElement('div');
        div.classList.add('log-entry');
        
        const timeSpan = document.createElement('span');
        timeSpan.classList.add('log-time');
        timeSpan.textContent = `[${new Date().toLocaleTimeString().split(' ')[0]}]`;
        
        const msgSpan = document.createElement('span');
        msgSpan.classList.add(`log-${type}`);
        msgSpan.textContent = ` ${message}`;
        
        div.appendChild(timeSpan);
        div.appendChild(msgSpan);
        
        logContainer.appendChild(div);
        
        const scrollContainer = document.getElementById('log-scroll-container');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }

    function highlightBlock(pageId, type) {
        renderCache();
        const block = cacheContainer.querySelector(`[data-page-id="${pageId}"]`);
        if (block) {
            block.classList.add(type === 'hit' ? 'highlight-hit' : 'highlight-miss');
        }
    }

    function highlightEvicted(pageId) {
        const block = cacheContainer.querySelector(`[data-page-id="${pageId}"]`);
        if (block) {
            block.classList.add('highlight-evict');
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.cache-slot').forEach(block => {
            block.classList.remove('highlight-hit', 'highlight-miss', 'highlight-evict');
        });
    }

    // --- Custom Dropdown Logic ---
    const customSelectButton = document.getElementById('custom-select-button');
    const customSelectMenu = document.getElementById('custom-select-menu');
    const customSelectText = document.getElementById('custom-select-text');
    const customSelectIcon = document.getElementById('custom-select-icon');
    const policySelect = document.getElementById('policy-select');
    const dropdownOptions = customSelectMenu.querySelectorAll('li');

    function toggleDropdown() {
        const isExpanded = customSelectMenu.classList.contains('opacity-100');
        if (isExpanded) {
            customSelectMenu.classList.replace('opacity-100', 'opacity-0');
            customSelectMenu.classList.replace('visible', 'invisible');
            customSelectMenu.classList.replace('scale-100', 'scale-95');
            customSelectIcon.classList.remove('rotate-180');
        } else {
            customSelectMenu.classList.replace('opacity-0', 'opacity-100');
            customSelectMenu.classList.replace('invisible', 'visible');
            customSelectMenu.classList.replace('scale-95', 'scale-100');
            customSelectIcon.classList.add('rotate-180');
        }
    }

    customSelectButton.addEventListener('click', toggleDropdown);

    dropdownOptions.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const text = option.querySelector('span').textContent;
            
            // Sync with hidden select and visible text
            customSelectText.textContent = text;
            policySelect.value = value;
            
            // Reset styling for all options
            dropdownOptions.forEach(opt => {
                opt.classList.remove('bg-slate-700/50', 'text-violet-300');
                opt.classList.add('text-slate-300');
                const titleSpan = opt.querySelector('span');
                titleSpan.classList.replace('font-semibold', 'font-normal');
                const checkIcon = opt.querySelector('.check-icon');
                if(checkIcon) checkIcon.remove();
            });
            
            // Apply active styling to clicked option
            option.classList.remove('text-slate-300');
            option.classList.add('bg-slate-700/50', 'text-violet-300');
            option.querySelector('span').classList.replace('font-normal', 'font-semibold');
            
            const checkHTML = `<span class="check-icon text-violet-400 absolute inset-y-0 right-0 flex items-center pr-4">
                                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                               </span>`;
            option.insertAdjacentHTML('beforeend', checkHTML);
            
            toggleDropdown();
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!customSelectButton.contains(e.target) && !customSelectMenu.contains(e.target)) {
            if (customSelectMenu.classList.contains('opacity-100')) {
                toggleDropdown();
            }
        }
    });

    // --- Event Listeners ---
    requestBtn.addEventListener('click', handleRequest);
    pageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleRequest();
        }
    });

    sizeInput.addEventListener('change', (e) => {
        let newSize = parseInt(e.target.value, 10);
        if (isNaN(newSize) || newSize < 2) newSize = 2;
        if (newSize > 32) newSize = 32; // max cap
        
        // ensure input reflects validated size
        e.target.value = newSize;

        if (newSize !== CACHE_SIZE) {
            CACHE_SIZE = newSize;
            cacheSizeBadge.textContent = `Size: ${CACHE_SIZE}`;
            
            // Reset simulation
            cache = [];
            cacheHistory = {};
            hits = 0;
            misses = 0;
            updateStatistics();
            
            logMessage(`Cache size changed to ${CACHE_SIZE}. System reset.`, 'info');
            
            // Re-render empty DOM slots
            cacheContainer.innerHTML = '';
            for (let i = 0; i < CACHE_SIZE; i++) {
                const slot = document.createElement('div');
                slot.className = 'cache-slot flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 text-slate-500 transition-all duration-300';
                slot.dataset.index = i;
                slot.innerHTML = `<span class="text-sm font-medium">Empty</span>`;
                cacheContainer.appendChild(slot);
            }
            renderCache();
        }
    });

    // --- Initial Render ---
    cacheContainer.innerHTML = '';
    for (let i = 0; i < CACHE_SIZE; i++) {
        const slot = document.createElement('div');
        slot.className = 'cache-slot flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 text-slate-500 transition-all duration-300';
        slot.dataset.index = i;
        slot.innerHTML = `<span class="text-sm font-medium">Empty</span>`;
        cacheContainer.appendChild(slot);
    }
    renderCache();

    // --- Research Paper Modal Logic ---
    const viewPaperBtn = document.getElementById('view-paper-btn');
    const paperModal = document.getElementById('paper-modal');
    const paperModalContent = document.getElementById('paper-modal-content');
    const paperModalBackdrop = document.getElementById('paper-modal-backdrop');
    const closePaperBtn = document.getElementById('close-paper-btn');

    function openPaperModal() {
        if (!paperModal) return;
        paperModal.classList.remove('invisible');
        // small delay to allow display to apply before opacity transition
        setTimeout(() => {
            paperModal.classList.remove('opacity-0');
            if (paperModalContent) {
                paperModalContent.classList.remove('scale-95');
                paperModalContent.classList.add('scale-100');
            }
        }, 10);
    }

    function closePaperModal() {
        if (!paperModal) return;
        paperModal.classList.add('opacity-0');
        if (paperModalContent) {
            paperModalContent.classList.remove('scale-100');
            paperModalContent.classList.add('scale-95');
        }
        setTimeout(() => {
            paperModal.classList.add('invisible');
        }, 300); // Wait for transition
    }

    if (viewPaperBtn) {
        viewPaperBtn.addEventListener('click', openPaperModal);
    }
    if (closePaperBtn) {
        closePaperBtn.addEventListener('click', closePaperModal);
    }
    if (paperModalBackdrop) {
        paperModalBackdrop.addEventListener('click', closePaperModal);
    }

});
