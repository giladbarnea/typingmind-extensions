/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: because */
// ==UserScript==
// @name         TypingMind: Chat Message Observer
// @namespace    http://tampermonkey.net/
// @version      2025-01-01
// @description  Observes and registers chat messages as they appear in TypingMind
// @author       You
// @match        https://www.typingmind.com/*
// @icon         https://www.typingmind.com/favicon-192x192.png
// @grant        none
// ==/UserScript==

(() => {
	console.log("🔍 Chat Message Observer: Script loaded.");

	// --- Chat Message Selectors ---
	const ChatMessageSelectors = {
		userMessage: "div[data-element-id=user-message]",
		aiResponse: "div[data-element-id=ai-response]", 
		responseBlock: "div[data-element-id=response-block]",
		chatContainer: "div.dynamic-chat-content-container",
	};

	// --- Message Registry ---
	class MessageRegistry {
		constructor() {
			this.messages = new Map();
			this.messageCounter = 0;
		}

		/**
		 * Registers a new chat message
		 * @param {Element} messageElement - The DOM element containing the message
		 * @param {string} type - Type of message ('user' or 'ai')
		 * @returns {string} - Unique message ID
		 */
		registerMessage(messageElement, type) {
			const messageId = `msg_${++this.messageCounter}_${Date.now()}`;
			const messageData = {
				id: messageId,
				type: type,
				element: messageElement,
				content: this._extractMessageContent(messageElement),
				timestamp: new Date(),
				processed: false
			};

			this.messages.set(messageId, messageData);
			
			console.log(`📝 Registered ${type} message:`, {
				id: messageId,
				content: messageData.content.substring(0, 100) + (messageData.content.length > 100 ? '...' : ''),
				timestamp: messageData.timestamp
			});

					// Trigger message processing
		this._processMessage(messageData);
			
			return messageId;
		}

		/**
		 * Extracts text content from a message element
		 * @param {Element} element - The message element
		 * @returns {string} - Cleaned message content
		 */
		_extractMessageContent(element) {
			// Clone the element to avoid modifying the original
			const clone = element.cloneNode(true);
			
			// Remove any buttons, metadata, or UI elements that aren't part of the actual message
			const elementsToRemove = clone.querySelectorAll('button, .metadata, .timestamp, [class*="copy"], [class*="edit"]');
			elementsToRemove.forEach(el => el.remove());
			
			return clone.textContent?.trim() || '';
		}

		/**
		 * Processes a registered message
		 * @param {Object} messageData - The message data object
		 */
		_processMessage(messageData) {
			if (messageData.processed) return;

			// Custom processing logic can be added here
			// For example: sentiment analysis, keyword extraction, etc.
			
			// Mark as processed
			messageData.processed = true;
			
			// Dispatch custom event for other scripts to listen to
			const event = new CustomEvent('chatMessageRegistered', {
				detail: {
					id: messageData.id,
					type: messageData.type,
					content: messageData.content,
					timestamp: messageData.timestamp
				}
			});
			document.dispatchEvent(event);
		}

		/**
		 * Gets all registered messages
		 * @returns {Array} - Array of message data objects
		 */
		getAllMessages() {
			return Array.from(this.messages.values());
		}

		/**
		 * Gets messages by type
		 * @param {string} type - Message type ('user' or 'ai')
		 * @returns {Array} - Array of filtered message data objects
		 */
		getMessagesByType(type) {
			return this.getAllMessages().filter(msg => msg.type === type);
		}
	}

	// --- Debug Classes for Edge Case Detection ---
	
	/**
	 * CONSERVATIVE: Detects when already registered messages have content changes
	 * Use case: User edits existing message, AI regenerates response
	 */
	class debug_MessageChangeDetector {
		constructor() {
			this.knownMessageContents = new Map(); // messageId -> content
			this.changeDetections = [];
			this.checkInterval = null;
		}

		/**
		 * Registers a message's initial content for change detection
		 * @param {string} messageId - The message ID from MessageRegistry
		 * @param {string} content - The current content
		 * @param {Element} element - The DOM element
		 */
		registerMessageContent(messageId, content, element) {
			this.knownMessageContents.set(messageId, {
				originalContent: content,
				element: element,
				lastChecked: Date.now()
			});
		}

		/**
		 * CONSERVATIVE: Checks if any registered messages have changed content
		 * Only checks messages that still exist in DOM
		 */
		checkForContentChanges() {
			const currentTime = Date.now();
			
			for (const [messageId, messageData] of this.knownMessageContents.entries()) {
				// Skip if element no longer exists in DOM
				if (!document.contains(messageData.element)) {
					continue;
				}

							// Extract current content using same method as MessageRegistry
			const currentContent = this._extractMessageContent(messageData.element);
				
							// CONSERVATIVE: Only flag if content is significantly different
			if (this._isSignificantChange(messageData.originalContent, currentContent)) {
					const detection = {
						messageId: messageId,
						originalContent: messageData.originalContent,
						newContent: currentContent,
						detectedAt: currentTime,
						element: messageData.element,
						changeType: 'content_modification'
					};

					this.changeDetections.push(detection);
					
					console.log('🔍 DEBUG_CHANGE: Content modification detected:', {
						messageId: messageId,
						originalLength: messageData.originalContent.length,
						newLength: currentContent.length,
						originalPreview: messageData.originalContent.substring(0, 50) + '...',
						newPreview: currentContent.substring(0, 50) + '...',
						element: messageData.element
					});

					// Update stored content to avoid duplicate detections
					messageData.originalContent = currentContent;
					messageData.lastChecked = currentTime;

									// Dispatch debug event
				this._dispatchChangeEvent(detection);
				}
			}
		}

		/**
		 * CONSERVATIVE: Determines if content change is significant enough to report
		 * @param {string} original - Original content
		 * @param {string} current - Current content
		 * @returns {boolean} - True if change is significant
		 */
		_isSignificantChange(original, current) {
			// Skip if either is empty (likely still loading)
			if (!original.trim() || !current.trim()) {
				return false;
			}

			// CONSERVATIVE: Must be different by more than just whitespace
			const normalizedOriginal = original.replace(/\s+/g, ' ').trim();
			const normalizedCurrent = current.replace(/\s+/g, ' ').trim();
			
			if (normalizedOriginal === normalizedCurrent) {
				return false;
			}

			// CONSERVATIVE: Significant length difference (>10% change)
			const lengthDiff = Math.abs(original.length - current.length);
			const lengthThreshold = Math.max(original.length * 0.1, 10); // 10% or minimum 10 chars
			
			return lengthDiff > lengthThreshold;
		}

		/**
		 * Extracts content same way as MessageRegistry
		 */
		_extractMessageContent(element) {
			const clone = element.cloneNode(true);
			const elementsToRemove = clone.querySelectorAll('button, .metadata, .timestamp, [class*="copy"], [class*="edit"]');
			elementsToRemove.forEach(el => el.remove());
			return clone.textContent?.trim() || '';
		}

		/**
		 * Starts periodic content checking
		 * @param {number} interval - Check interval in ms (default 2000ms)
		 */
		startPeriodicChecking(interval = 2000) {
			if (this.checkInterval) {
				clearInterval(this.checkInterval);
			}

			this.checkInterval = setInterval(() => {
				this.checkForContentChanges();
			}, interval);

			console.log('🔍 DEBUG_CHANGE: Started periodic content checking every', interval, 'ms');
		}

		/**
		 * Stops periodic checking
		 */
		stopPeriodicChecking() {
			if (this.checkInterval) {
				clearInterval(this.checkInterval);
				this.checkInterval = null;
			}
		}

		/**
		 * Dispatches change detection event
		 */
		_dispatchChangeEvent(detection) {
			const event = new CustomEvent('debug_messageContentChanged', {
				detail: detection
			});
			document.dispatchEvent(event);
		}

		/**
		 * Gets all detected changes
		 */
		getDetectedChanges() {
			return [...this.changeDetections];
		}
	}

	/**
	 * CONSERVATIVE: Detects when registered messages are removed from DOM
	 * Use case: User deletes a message from conversation
	 */
	class debug_MessageRemovalDetector {
		constructor() {
			this.removalDetections = [];
			this.trackedElements = new Map(); // element -> messageData
		}

		/**
		 * Starts tracking an element for removal detection
		 * @param {string} messageId - The message ID from MessageRegistry
		 * @param {Element} element - The DOM element to track
		 * @param {string} messageType - 'user' or 'ai'
		 */
		trackElementForRemoval(messageId, element, messageType) {
			this.trackedElements.set(element, {
				messageId: messageId,
				messageType: messageType,
				registeredAt: Date.now()
			});
		}

		/**
		 * CONSERVATIVE: Checks removed nodes for tracked message elements
		 * @param {MutationRecord[]} mutations - The mutation records
		 */
		checkRemovedNodes(mutations) {
			for (const mutation of mutations) {
				if (mutation.type !== 'childList' || !mutation.removedNodes.length) {
					continue;
				}

				for (const removedNode of mutation.removedNodes) {
					if (removedNode.nodeType !== Node.ELEMENT_NODE) {
						continue;
					}

									// Check if the removed node itself is a tracked element
				this._checkIfRemovedElementIsTracked(removedNode);

									// CONSERVATIVE: Check if removed node contains any tracked elements
				this._checkIfRemovedNodeContainsTrackedElements(removedNode);
				}
			}
		}

		/**
		 * Checks if a removed element is one we're tracking
		 */
		_checkIfRemovedElementIsTracked(removedElement) {
					if (this.trackedElements.has(removedElement)) {
			const messageData = this.trackedElements.get(removedElement);
			this._recordRemoval(removedElement, messageData, 'direct_removal');
		}
		}

		/**
		 * CONSERVATIVE: Checks if removed node contains tracked elements
		 */
		_checkIfRemovedNodeContainsTrackedElements(removedNode) {
			// Check all tracked elements to see if any are descendants of removed node
			for (const [trackedElement, messageData] of this.trackedElements.entries()) {
							if (removedNode.contains(trackedElement)) {
				this._recordRemoval(trackedElement, messageData, 'ancestor_removal');
			}
			}
		}

		/**
		 * Records a removal detection
		 */
		_recordRemoval(element, messageData, removalType) {
			const detection = {
				messageId: messageData.messageId,
				messageType: messageData.messageType,
				element: element,
				removalType: removalType,
				detectedAt: Date.now(),
				registeredAt: messageData.registeredAt
			};

			this.removalDetections.push(detection);

			console.log('🔍 DEBUG_REMOVAL: Message removal detected:', {
				messageId: messageData.messageId,
				messageType: messageData.messageType,
				removalType: removalType,
				lifespan: detection.detectedAt - messageData.registeredAt + 'ms'
			});

			// Clean up tracking
			this.trackedElements.delete(element);

					// Dispatch debug event
		this._dispatchRemovalEvent(detection);
		}

		/**
		 * Dispatches removal detection event
		 */
		_dispatchRemovalEvent(detection) {
			const event = new CustomEvent('debug_messageRemoved', {
				detail: detection
			});
			document.dispatchEvent(event);
		}

		/**
		 * Gets all detected removals
		 */
		getDetectedRemovals() {
			return [...this.removalDetections];
		}

		/**
		 * Gets currently tracked elements count
		 */
		getTrackedElementsCount() {
			return this.trackedElements.size;
		}
	}

	// --- Chat Message Observer ---
	class ChatMessageObserver {
		constructor() {
			this.registry = new MessageRegistry();
			this.observer = null;
			this.isObserving = false;
			this.processedElements = new WeakSet();
			
			// Debug detectors (CONSERVATIVE)
			this.debug_changeDetector = new debug_MessageChangeDetector();
			this.debug_removalDetector = new debug_MessageRemovalDetector();
		}

		/**
		 * Starts observing for chat messages
		 */
		startObserving() {
			if (this.isObserving) {
				console.warn("🔍 Chat Message Observer: Already observing");
				return;
			}

			// Find the chat container
			const chatContainer = document.querySelector(ChatMessageSelectors.chatContainer) || document.body;
			
			if (!chatContainer) {
				console.error("🔍 Chat Message Observer: Could not find chat container");
				return;
			}

					// Create mutation observer
		this.observer = new MutationObserver((mutations) => {
			this._handleMutations(mutations);
		});

			// Start observing
			this.observer.observe(chatContainer, {
				childList: true,
				subtree: true,
				attributes: false,
				characterData: false
			});

			this.isObserving = true;
			console.log("🔍 Chat Message Observer: Started observing chat container");

			// Start debug detectors
			this.debug_changeDetector.startPeriodicChecking(2000); // Check every 2 seconds

					// Process any existing messages
		this._processExistingMessages();
		}

		/**
		 * Stops observing for chat messages
		 */
		stopObserving() {
			if (this.observer) {
				this.observer.disconnect();
				this.observer = null;
			}
			
			// Stop debug detectors
			this.debug_changeDetector.stopPeriodicChecking();
			
			this.isObserving = false;
			console.log("🔍 Chat Message Observer: Stopped observing");
		}

			/**
	 * Handles DOM mutations
	 * @param {MutationRecord[]} mutations - Array of mutation records
	 */
	_handleMutations(mutations) {
			// CONSERVATIVE: Check for removed messages first
			this.debug_removalDetector.checkRemovedNodes(mutations);
			
			for (const mutation of mutations) {
				if (mutation.type !== 'childList') continue;

				// Check added nodes for new messages
				for (const addedNode of mutation.addedNodes) {
									if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;
				
				this._checkForNewMessages(addedNode);
				}
			}
		}

			/**
	 * Checks if an element or its children contain new chat messages
	 * @param {Element} element - Element to check
	 */
	_checkForNewMessages(element) {
					// Check if the element itself is a message
		this._processIfMessage(element);

		// Check all descendants for messages
		const userMessages = element.querySelectorAll(ChatMessageSelectors.userMessage);
		const aiResponses = element.querySelectorAll(ChatMessageSelectors.aiResponse);

		userMessages.forEach(msg => this._processIfMessage(msg));
		aiResponses.forEach(msg => this._processIfMessage(msg));
		}

			/**
	 * Processes an element if it's a chat message
	 * @param {Element} element - Element to check and process
	 */
	_processIfMessage(element) {
			// Skip if already processed
			if (this.processedElements.has(element)) return;

			let messageType = null;

			// Determine message type
			if (element.matches(ChatMessageSelectors.userMessage)) {
				messageType = 'user';
			} else if (element.matches(ChatMessageSelectors.aiResponse)) {
				messageType = 'ai';
			}

			// If it's a message, register it
			if (messageType) {
				this.processedElements.add(element);
				const messageId = this.registry.registerMessage(element, messageType);
				
				// CONSERVATIVE: Start tracking for debug detection
				const content = this.registry.messages.get(messageId).content;
				this.debug_changeDetector.registerMessageContent(messageId, content, element);
				this.debug_removalDetector.trackElementForRemoval(messageId, element, messageType);
			}
		}

			/**
	 * Processes any existing messages in the DOM
	 */
	_processExistingMessages() {
			console.log("🔍 Processing existing messages...");
			
					const userMessages = document.querySelectorAll(ChatMessageSelectors.userMessage);
		const aiResponses = document.querySelectorAll(ChatMessageSelectors.aiResponse);

		userMessages.forEach(msg => this._processIfMessage(msg));
		aiResponses.forEach(msg => this._processIfMessage(msg));

			console.log(`🔍 Processed ${userMessages.length} user messages and ${aiResponses.length} AI responses`);
		}

		/**
		 * Gets the message registry
		 * @returns {MessageRegistry} - The message registry instance
		 */
		getRegistry() {
			return this.registry;
		}

		/**
		 * CONSERVATIVE DEBUG: Gets debug detection results for analysis
		 * @returns {Object} - Debug detection data
		 */
		getDebugDetections() {
			return {
				contentChanges: this.debug_changeDetector.getDetectedChanges(),
				removals: this.debug_removalDetector.getDetectedRemovals(),
				trackedElementsCount: this.debug_removalDetector.getTrackedElementsCount(),
				stats: {
					totalChanges: this.debug_changeDetector.getDetectedChanges().length,
					totalRemovals: this.debug_removalDetector.getDetectedRemovals().length,
					totalMessages: this.registry.getAllMessages().length
				}
			};
		}

		/**
		 * CONSERVATIVE DEBUG: Triggers manual content check for immediate analysis
		 */
		triggerDebugContentCheck() {
			console.log("🔍 DEBUG: Manual content check triggered");
			this.debug_changeDetector.checkForContentChanges();
		}
	}

	// --- Page Initialization ---
	function waitForPageLoad(callback, maxWait = 10000) {
		const startTime = Date.now();
		
		function checkReady() {
			const chatContainer = document.querySelector(ChatMessageSelectors.chatContainer);
			
			if (chatContainer || (Date.now() - startTime > maxWait)) {
				callback();
			} else {
				setTimeout(checkReady, 100);
			}
		}
		
		checkReady();
	}

	// --- Global Instance ---
	let chatObserver = null;

	// Initialize when page is ready
	waitForPageLoad(() => {
		console.log("🔍 Chat Message Observer: Page is ready, initializing...");
		
		chatObserver = new ChatMessageObserver();
		chatObserver.startObserving();

		// Make the observer available globally for debugging/external access
		window.ChatMessageObserver = chatObserver;
		
		// CONSERVATIVE DEBUG: Set up event listeners for analysis
		document.addEventListener('debug_messageContentChanged', (event) => {
			console.log('🔍 DEBUG EVENT: Content changed:', event.detail);
		});
		
		document.addEventListener('debug_messageRemoved', (event) => {
			console.log('🔍 DEBUG EVENT: Message removed:', event.detail);
		});
		
		console.log("🔍 Chat Message Observer: Initialization complete");
		console.log("🔍 Access via: window.ChatMessageObserver.getRegistry()");
		console.log("🔍 DEBUG: Access via: window.ChatMessageObserver.getDebugDetections()");
		console.log("🔍 DEBUG: Manual check via: window.ChatMessageObserver.triggerDebugContentCheck()");
	});

	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
		if (chatObserver) {
			chatObserver.stopObserving();
		}
	});

})();