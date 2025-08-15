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
				content: this.extractMessageContent(messageElement),
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
			this.processMessage(messageData);
			
			return messageId;
		}

		/**
		 * Extracts text content from a message element
		 * @param {Element} element - The message element
		 * @returns {string} - Cleaned message content
		 */
		extractMessageContent(element) {
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
		processMessage(messageData) {
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

	// --- Chat Message Observer ---
	class ChatMessageObserver {
		constructor() {
			this.registry = new MessageRegistry();
			this.observer = null;
			this.isObserving = false;
			this.processedElements = new WeakSet();
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
				this.handleMutations(mutations);
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

			// Process any existing messages
			this.processExistingMessages();
		}

		/**
		 * Stops observing for chat messages
		 */
		stopObserving() {
			if (this.observer) {
				this.observer.disconnect();
				this.observer = null;
			}
			this.isObserving = false;
			console.log("🔍 Chat Message Observer: Stopped observing");
		}

		/**
		 * Handles DOM mutations
		 * @param {MutationRecord[]} mutations - Array of mutation records
		 */
		handleMutations(mutations) {
			for (const mutation of mutations) {
				if (mutation.type !== 'childList') continue;

				// Check added nodes for new messages
				for (const addedNode of mutation.addedNodes) {
					if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;
					
					this.checkForNewMessages(addedNode);
				}
			}
		}

		/**
		 * Checks if an element or its children contain new chat messages
		 * @param {Element} element - Element to check
		 */
		checkForNewMessages(element) {
			// Check if the element itself is a message
			this.processIfMessage(element);

			// Check all descendants for messages
			const userMessages = element.querySelectorAll(ChatMessageSelectors.userMessage);
			const aiResponses = element.querySelectorAll(ChatMessageSelectors.aiResponse);

			userMessages.forEach(msg => this.processIfMessage(msg));
			aiResponses.forEach(msg => this.processIfMessage(msg));
		}

		/**
		 * Processes an element if it's a chat message
		 * @param {Element} element - Element to check and process
		 */
		processIfMessage(element) {
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
				this.registry.registerMessage(element, messageType);
			}
		}

		/**
		 * Processes any existing messages in the DOM
		 */
		processExistingMessages() {
			console.log("🔍 Processing existing messages...");
			
			const userMessages = document.querySelectorAll(ChatMessageSelectors.userMessage);
			const aiResponses = document.querySelectorAll(ChatMessageSelectors.aiResponse);

			userMessages.forEach(msg => this.processIfMessage(msg));
			aiResponses.forEach(msg => this.processIfMessage(msg));

			console.log(`🔍 Processed ${userMessages.length} user messages and ${aiResponses.length} AI responses`);
		}

		/**
		 * Gets the message registry
		 * @returns {MessageRegistry} - The message registry instance
		 */
		getRegistry() {
			return this.registry;
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
		
		console.log("🔍 Chat Message Observer: Initialization complete");
		console.log("🔍 Access via: window.ChatMessageObserver.getRegistry()");
	});

	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
		if (chatObserver) {
			chatObserver.stopObserving();
		}
	});

})();