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
	// Simplified DOM change tracker: single MutationObserver and minimal registry
	const S = {
		user: "div[data-element-id=user-message]",
		ai: "div[data-element-id=ai-response]",
		container: "div.dynamic-chat-content-container",
	};
	const MESSAGE_SELECTOR = `${S.user}, ${S.ai}`;

	const extractMessageText = (element) => {
		const clone = element.cloneNode(true);
		clone
			.querySelectorAll(
				'button, .metadata, .timestamp, [class*="copy"], [class*="edit"]',
			)
			.forEach((x) => x.remove());
		return clone.textContent?.trim() || "";
	};

	const getMessageType = (element) => (element.matches(S.user) ? "user" : "ai");

	const elementToMessageData = new Map();
	const elementToId = new WeakMap();
	let messageCounter = 0;
	const nextMessageId = () => `msg_${++messageCounter}_${Date.now()}`;

	const handleAdd = (element) => {
		const id = nextMessageId();
		const type = getMessageType(element);
		const content = extractMessageText(element);
		elementToMessageData.set(element, {
			id,
			type,
			content,
			timestamp: Date.now(),
		});
		elementToId.set(element, id);
		console.log("📝 add", { id, type, sample: content.slice(0, 100) });
	};

	const handleChange = (element) => {
		const data = elementToMessageData.get(element);
		if (!data) return;
		const current = extractMessageText(element);
		const prev = data.content.replace(/\s+/g, " ").trim();
		const curr = current.replace(/\s+/g, " ").trim();
		if (prev === curr) return;
		data.content = current;
		data.timestamp = Date.now();
		console.log("✏️ change", { id: data.id });
	};

	const handleRemove = (element) => {
		const id = elementToId.get(element);
		if (!id) return;
		elementToMessageData.delete(element);
		console.log("🗑️ remove", { id });
	};

	const root = document.querySelector(S.container) || document.body;

	const processExistingMessages = () => {
		root.querySelectorAll(MESSAGE_SELECTOR).forEach((el) => {
			if (!elementToMessageData.has(el)) handleAdd(el);
		});
	};

	const collectRemovedMessages = (node, collector) => {
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const el = node;
		if (el.matches(MESSAGE_SELECTOR)) collector.add(el);
		el.querySelectorAll?.(MESSAGE_SELECTOR).forEach((m) => collector.add(m));
	};

	const findClosestMessageElement = (node) => {
		if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
		if (!(node instanceof Element)) return null;
		return node.closest(MESSAGE_SELECTOR);
	};

	const mutationCallback = (mutations) => {
		const removedSet = new Set();
		const affectedSet = new Set();

		for (const mutation of mutations) {
			if (mutation.type === "childList") {
				mutation.removedNodes.forEach((n) =>
					collectRemovedMessages(n, removedSet),
				);
				mutation.addedNodes.forEach((n) => {
					if (n.nodeType !== Node.ELEMENT_NODE) return;
					const el = n;
					if (el.matches(MESSAGE_SELECTOR)) affectedSet.add(el);
					el.querySelectorAll?.(MESSAGE_SELECTOR).forEach((m) =>
						affectedSet.add(m),
					);
				});
			} else if (
				mutation.type === "characterData" ||
				mutation.type === "attributes"
			) {
				const el = findClosestMessageElement(mutation.target);
				if (el) affectedSet.add(el);
			}
		}

		for (const el of removedSet) {
			if (!document.contains(el) && elementToMessageData.has(el))
				handleRemove(el);
		}

		for (const el of affectedSet) {
			if (!document.contains(el)) continue;
			if (!elementToMessageData.has(el)) handleAdd(el);
			else handleChange(el);
		}
	};

	const observer = new MutationObserver(mutationCallback);
	observer.observe(root, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});

	processExistingMessages();

	window.ChatMessageObserver = {
		start() {
			observer.observe(root, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			});
		},
		stop() {
			observer.disconnect();
		},
		snapshot() {
			return Array.from(elementToMessageData.values());
		},
	};

	window.addEventListener("beforeunload", () => {
		observer.disconnect();
	});
})();
