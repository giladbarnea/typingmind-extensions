/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: because */
// ==UserScript==
// @name         Typingmind: Improved UI/UX
// @namespace    http://tampermonkey.net/
// @version      2025-08-01
// @description  Typingmind: Improved UI/UX
// @author       You
// @match        https://www.typingmind.com/*
// @icon         https://www.typingmind.com/favicon-192x192.png
// @grant        none
// ==/UserScript==

(() => {
	const TopButtonsContainerSelector =
		'div[data-element-id="current-chat-title"] > div';

	const DbName = "keyval-store";
	const StoreName = "keyval";

	// --- Utility Functions ---
	function getFromIndexedDb(dbName, storeName, key) {
		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(dbName);
			request.onerror = () =>
				reject(new Error(`Failed to open IndexedDB: ${dbName}`));
			request.onsuccess = (event) => {
				const db = event.target.result;
				if (!db.objectStoreNames.contains(storeName)) {
					return reject(
						new Error(`Store "${storeName}" not found in DB "${dbName}"`),
					);
				}
				const transaction = db.transaction([storeName], "readonly");
				const store = transaction.objectStore(storeName);
				const getRequest = store.get(key);
				getRequest.onsuccess = () => resolve(getRequest.result);
				getRequest.onerror = () =>
					reject(new Error(`Failed to retrieve data from store: ${storeName}`));
			};
			request.onupgradeneeded = () =>
				console.warn("Database upgrade needed or creation started.");
		});
	}

	const SaveChat = {
		_buttonId: "save-chat-button",

		_triggerDownload(filename, data) {
			const blob = new Blob([data], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},

		/**
		 * Creates and injects the "Save Chat" button into the DOM.
		 */
		addSaveChatButton() {
			const buttonContainer = document.querySelector(
				TopButtonsContainerSelector,
			);
			if (!buttonContainer || SaveChat._saveButtonExists()) {
				return;
			}

			console.log('[save-chat] Adding "Save" button.');

			const saveButton = document.createElement("button");
			saveButton.id = SaveChat._buttonId;
			saveButton.className =
				"w-9 justify-center dark:hover:bg-white/20 dark:active:bg-white/25 dark:disabled:text-neutral-500 hover:bg-slate-900/20 active:bg-slate-900/25 disabled:text-neutral-400 focus-visible:outline-offset-2 focus-visible:outline-slate-500 text-slate-900 dark:text-white inline-flex items-center rounded-lg h-9 transition-all group font-semibold text-xs";
			saveButton.setAttribute("data-tooltip-id", "global");
			saveButton.setAttribute("data-tooltip-content", "Save Chat as JSON");

			const saveIcon = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"svg",
			);
			saveIcon.setAttribute("class", "w-[18px] h-[18px]");
			saveIcon.setAttribute("viewBox", "0 0 24 24");
			saveIcon.setAttribute("fill", "none");
			saveIcon.setAttribute("stroke", "currentColor");
			saveIcon.setAttribute("stroke-width", "1.5");
			saveIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />`;
			saveButton.appendChild(saveIcon);

			saveButton.addEventListener("click", async () => {
				const url = window.location.href;
				const match = url.match(/#chat=([^&]+)/);
				if (!match) {
					alert(`[save-chat] Could not find a chat ID in the URL: ${url}`);
					return;
				}
				const chatId = match[1];

				console.log(
					`[save-chat] Attempting to fetch chat "${chatId}" to save it...`,
				);
				try {
					const value = await getFromIndexedDb(
						DbName,
						StoreName,
						`CHAT_${chatId}`,
					);
					if (value === undefined) {
						alert(`No value found for key: "CHAT_${chatId}"`);
						return;
					}

					console.log(
						"[save-chat] SUCCESS: Found value. Triggering download...",
					);
					const jsonString = JSON.stringify(value, null, 2);

					const now = new Date();
					const year = now.getFullYear().toString().slice(-2);
					const month = (now.getMonth() + 1).toString().padStart(2, "0");
					const day = now.getDate().toString().padStart(2, "0");
					const hours = now.getHours().toString().padStart(2, "0");
					const minutes = now.getMinutes().toString().padStart(2, "0");
					const seconds = now.getSeconds().toString().padStart(2, "0");

					const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
					const filename = `${timestamp}-${chatId}.json`;

					SaveChat._triggerDownload(filename, jsonString);
				} catch (error) {
					console.error(
						"[save-chat] ERROR: Failed to access IndexedDB.",
						error,
					);
					alert("Error accessing IndexedDB. See console for details.");
				}
			});

			buttonContainer.prepend(saveButton);
		},

		_saveButtonExists() {
			return !!document.getElementById(SaveChat._buttonId);
		},
	};

	const StopButton = {
		_buttonId: "stop-button",
		/**
		 * Creates the "Stop" button for stopping LLM streaming.
		 * Not implemented yet.
		 */
		addStopButton() {
			const buttonContainer = document.querySelector(
				TopButtonsContainerSelector,
			);
			if (!buttonContainer || StopButton._stopButtonExists()) {
				return;
			}

			console.log('[stop-button] Adding "Stop" button.');

			const stopButton = document.createElement("button");
			stopButton.id = StopButton._buttonId;
			stopButton.className =
				"w-9 justify-center dark:hover:bg-white/20 dark:active:bg-white/25 dark:disabled:text-neutral-500 hover:bg-slate-900/20 active:bg-slate-900/25 disabled:text-neutral-400 focus-visible:outline-offset-2 focus-visible:outline-slate-500 text-slate-900 dark:text-white inline-flex items-center rounded-lg h-9 transition-all group font-semibold text-xs";
			stopButton.setAttribute("data-tooltip-id", "global");
			stopButton.setAttribute("data-tooltip-content", "Stop Generating");

			const stopIcon = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"svg",
			);
			stopIcon.setAttribute("class", "w-[18px] h-[18px]");
			stopIcon.setAttribute("viewBox", "0 0 24 24");
			stopIcon.setAttribute("fill", "currentColor");
			stopIcon.innerHTML = `<rect x="5" y="5" width="14" height="14" rx="3" ry="3" />`;
			stopButton.appendChild(stopIcon);

			buttonContainer.prepend(stopButton);
		},

		_stopButtonExists() {
			return !!document.getElementById(StopButton._buttonId);
		},
	};

	const Sidebar = {
		_selector: 'div[data-element-id="nav-container"]',
		_toggleButtonSelector: 'button[aria-label="Open sidebar"]',
		_isOpen() {
			return !document.querySelector(Sidebar._selector).matches(".opacity-0");
		},
		close() {
			if (Sidebar._isOpen()) {
				console.log("[sidebar] Closing sidebar.");
				document.querySelector(Sidebar._toggleButtonSelector).click();
			}
		},
	};
	const ChatMessages = {
		_userMessageSelector: "div[data-element-id=user-message]",
		_aiResponseSelector: "div[data-element-id=ai-response]",
		responseBlockSelector: "div[data-element-id=response-block]",

		removeHoverClasses(node) {
			const nodeRepr = node
				? [`specific node: `, node]
				: [
						`all ${
							[...document.querySelectorAll(ChatMessages.responseBlockSelector)]
								.length
						} responseBlockSelector nodes`,
					];
			console.log(
				`[remove-hover-classes] Removing hover classes from `,
				...nodeRepr,
			);
			if (node) {
				node.classList.remove("hover:bg-slate-50", "dark:hover:bg-white/5");
			} else {
				document
					.querySelectorAll(ChatMessages.responseBlockSelector)
					.forEach(ChatMessages.removeHoverClasses);
			}
		},
		makeAlignedAndLessWide(node) {
			const chatContentContainer = document.querySelector(
				"div.dynamic-chat-content-container",
			);
			if (!chatContentContainer.classList.contains("max-w-3xl", "mx-auto")) {
				chatContentContainer.classList.add("max-w-3xl", "mx-auto");
			}

			const shrinkUserMessage = (userMsgResponseBlock) => {
				["ml-auto", "mr-0", "max-w-xl"].forEach((cls) => {
					if (!userMsgResponseBlock.classList.contains(cls))
						userMsgResponseBlock.classList.add("ml-auto", "mr-0", "max-w-xl");
				});

				// Remove the hardcoded max-width style
				userMsgResponseBlock.style["max-width"] = "";
			};
			const shrinkAssistantMessage = (aiMsgResponseBlock) => {
				// We like mx-auto because it centers the message, so we don't remove it.
				if (!aiMsgResponseBlock.classList.contains("max-w-xl"))
					aiMsgResponseBlock.classList.add("max-w-xl");

				aiMsgResponseBlock.style["max-width"] = "";
			};
			const fullUserMessageSelector = `${ChatMessages.responseBlockSelector}:has(>div>div>${ChatMessages._userMessageSelector})`;
			const fullAiMessageSelector = `${ChatMessages.responseBlockSelector}:has(>div>${ChatMessages._aiResponseSelector})`;
			if (node?.matches(fullUserMessageSelector)) {
				console.log(
					`[align-shrink-msgs] Shrinking specific user message:`,
					node,
				);
				shrinkUserMessage(node);
			} else if (node?.matches(fullAiMessageSelector)) {
				console.log(
					`[align-shrink-msgs] Shrinking specific assistant message:`,
					node,
				);
				shrinkAssistantMessage(node);
			} else {
				const allUserMessages = [
					...document.querySelectorAll(fullUserMessageSelector),
				];
				const allAiMessages = [
					...document.querySelectorAll(fullAiMessageSelector),
				];
				console.log(
					`[align-shrink-msgs] Shrinking all ${allUserMessages.length} user messages and ${allAiMessages.length} assistant messages.`,
				);
				allUserMessages.forEach(shrinkUserMessage);
				allAiMessages.forEach(shrinkAssistantMessage);
			}
		},
	};
	const InputBox = {
		/* Relevant to anywhere in this script where input box selectors are concerned. 
		I saw this snippet in someone else's script. Would be informative to explore these techniques:
	    const messageInput = document.querySelector(
			'[data-element-id="message-input"]',
		);
		if (messageInput) {
			const inputRow = messageInput.querySelector('[data-element-id="input-row"]');
			if (inputRow) {
				const wfullDiv = inputRow.querySelector(".w-full");
				if (wfullDiv) {
					const chatInputContainer = wfullDiv.querySelector(
						'[data-element-id="chat-input-textbox-container"]',
					)?.parentElement;
					if (chatInputContainer) {
						wfullDiv.insertBefore(newLabel, chatInputContainer);
					}
				}
			}
		}
		*/
		_textboxSelector: 'textarea[data-element-id="chat-input-textbox"]',
		_state: {
			expanded: false,
		},
		_initialHeight: undefined, // For some reason, on app launch, the box element has a hardcoded height. Not a class. So we need to store it.
		_expandedHeight: undefined,
		get _element() {
			return document.querySelector(InputBox._textboxSelector);
		},
		_initState() {
			if (InputBox._initialHeight !== undefined) {
				return;
			}
			InputBox._initialHeight = getComputedStyle(InputBox._element).height;

			// Give it the height of the chat space middle part, as an approximation of "most of the screen."
			InputBox._expandedHeight = getComputedStyle(
				document.querySelector('div[data-element-id="chat-space-middle-part"]'),
			).height;
		},

		/* Needs a button for this, haven't implemented it yet. */
		toggleExpand() {
			InputBox._initState();

			if (InputBox._state.expanded) {
				InputBox._element.classList.add("max-h-[500px]");
				InputBox._element.style.height = InputBox._initialHeight;
				InputBox._state.expanded = false;
			} else {
				InputBox._element.classList.remove("max-h-[500px]");
				InputBox._element.style.height = InputBox._expandedHeight;
				InputBox._state.expanded = true;
			}
		},

		mergeButtonRows() {
			// note: flimsy because will break if any other button is added to the input actions.
			const alreadyMerged =
				document.querySelectorAll(
					'[data-element-id="chat-input-actions"]>div>button',
				).length !== 2;
			if (alreadyMerged) return;

			const presentationContainer = document.querySelector(
				'div[role="presentation"]',
			);
			presentationContainer.classList.remove("rounded-xl", "dark:bg-slate-950");
			presentationContainer.classList.add("rounded-3xl");

			// Cut&Paste model and plugin menus under #chat-input-actions>div.justify-start
			const [modelSelector, pluginsMenu] = [
				...document
					.querySelector('[data-element-id="chat-space-end-part"]')
					.parentElement.querySelectorAll("button"),
			].slice(0, 2);
			const newParent = document.querySelector(
				'[data-element-id="chat-input-actions"]>div',
			);
			modelSelector.querySelectorAll("svg").forEach((svg) => svg.remove());
			pluginsMenu.querySelectorAll("svg").forEach((svg) => svg.remove());
			newParent.appendChild(modelSelector);
			newParent.appendChild(pluginsMenu);
			console.log("[input-box] Merged button rows.");
		},
	};

	// --- Main Logic ---
	console.log("[main] 🚀 Improved UI/UX: Script loaded.");

	// #region ---[ Page Modifications ]---

	/**
	 * Executes a callback when the page has "settled" down.
	 * This is useful for modern, reactive websites where content loads asynchronously.
	 *
	 * @param {() => void} callback The function to call when the page is settled.
	 * @param {number} [settleTime=500] The time in milliseconds of inactivity to wait for.
	 * @param {Element} [targetNode=document.body] The DOM element to observe for mutations.
	 */
	function onPageSettled(
		callback,
		settleTime = 500,
		targetNode = document.body,
	) {
		let settleTimer;

		// Create an observer instance linked to a callback function
		const observer = new MutationObserver((mutationsList, obs) => {
			// We've detected a mutation, so we clear the existing timer
			clearTimeout(settleTimer);

			// And start a new one
			settleTimer = setTimeout(() => {
				// If this timer completes, it means no mutations have occurred in `settleTime` ms.
				console.log("[onPageSettled] Page has settled. Firing callback.");

				// We can now disconnect the observer to prevent further checks
				obs.disconnect();

				// And execute the user's callback function
				callback();
			}, settleTime);
		});

		// Configuration for the observer:
		const config = {
			childList: true,
			subtree: true,
			attributes: true,
		};

		// Start observing the target node for configured mutations
		observer.observe(targetNode, config);

		// We also start the initial timer, in case the page is already static
		// or loads faster than the observer can be set up.
		settleTimer = setTimeout(() => {
			console.log(
				"[onPageSettled] Initial settle time reached. Firing callback.",
			);
			observer.disconnect();
			callback();
		}, settleTime);
	}

	function _debug_extractBasicNodeInfo(node) {
		// const outerHtmlWithoutChildren = node.outerHTML.replace(/<[^>]*>/g, "");
		const nodeCopyWithoutChildren = node.cloneNode(false);
		const basicAttributes = [
			"nodeType",
			"nodeName",
			"tagName",
			"id",
			"data-element-id",
		];
		const basicInfo = {};
		for (const attribute of basicAttributes) {
			if (node[attribute] !== undefined) {
				basicInfo[attribute] = node[attribute];
			} else if (node.getAttribute?.(attribute) !== undefined) {
				basicInfo[attribute] = node.getAttribute(attribute);
			}
		}
		if (node.classList) {
			basicInfo.classList = [...node.classList];
		}
		return {
			...basicInfo,
			outerHTML: nodeCopyWithoutChildren.outerHTML,
		};
	}

	/**
	 * Must be called only when inChat is true.
	 * @param {MutationRecord[]} mutations - The mutations to process.
	 */
	function improveChatUsability(mutations) {
		console.group(
			`[improve-chat-usability] Processing ${Object.entries(
				mutations.reduce((acc, m) => {
					acc[m.type] = (acc[m.type] || 0) + 1;
					return acc;
				}, {}),
			)
				.map(([type, count]) => `${count} ${type}`)
				.join(", ")}.`,
			mutations,
		);
		for (const mutation of mutations) {
			const target = mutation.target;
			if (target?.matches?.(ChatMessages.responseBlockSelector)) {
				ChatMessages.removeHoverClasses(target);
				ChatMessages.makeAlignedAndLessWide(target);
				console.log("[improve-chat-usability] mutation target matched responseBlock.");
			} else if (target?.matches?.(ChatMessages._aiResponseSelector)) {
				console.warn(
					"[improve-chat-usability] mutation target didn't match responseBlock but did match aiResponse.",
				);
			} else if (target?.matches?.(ChatMessages._userMessageSelector)) {
				console.warn(
					"[improve-chat-usability] mutation target didn't match responseBlock but did match userMessage.",
				);
			}
		}
		console.groupEnd();
	}
	const PageState = {
		sideBarOpen: false,
		inChat: false,
		_inChatDataIds: new Set([
			// "chat-folder",
			// "chat-space-background",
			// "chat-space-beginning-part",
			// "current-chat-title",
			// "chat-space-middle-part",
			// "chat-date-info",
			// "chat-space-end-part",
			// "chat-input-textbox-container",
			// "chat-input-actions"
		]),
		_sidebarOpenDataIds: new Set([
			// "chat-folder",
			"custom-chat-item",
			"selected-chat-item",
			// "chat-space-background",
			// "chat-space-beginning-part",
			// "current-chat-title",
			// "chat-space-middle-part",
			// "chat-date-info",
			// "chat-space-end-part",
			// "chat-input-textbox-container",
			// "chat-input-actions"
		]),
		inferFromDom() {
			PageState.sideBarOpen = !!document.querySelector(
				'div[data-element-id="selected-chat-item"]',
			);

			// Probable bug: not having an open sidebar doesn't mean we're in chat. This is likely true when Settings are open, for example.
			// Fix by copying inferFromMutationsInplace logic.
			PageState.inChat =
				document.querySelector('div[data-element-id="selected-chat-item"]') ==
					null &&
				document.querySelector('[data-element-id="nav-handler"]') == null &&
				document.querySelector('[data-element-id="custom-chat-item"]') == null;

			return {
				sideBarOpen: PageState.sideBarOpen,
				inChat: PageState.inChat,
			};
		},
		inferFromMutationsInplace(mutations, { onEnterChat, onSidebarOpen }) {
			const allAddedNodes = [];
			const allAttributeMutatedNodes = [];
			mutations.forEach((m) => {
				allAddedNodes.push(...m.addedNodes);
				if (m.type === "attributes") {
					allAttributeMutatedNodes.push({
						target: m.target,
						attribute: m.attributeName,
						dataElementId: m.target.getAttribute?.("data-element-id"),
						attributes: new Map(
							[...m.target.attributes].map((attr) => [
								attr.name,
								m.target.getAttribute(attr.name),
							]),
						),
					});
				}
			});

			const openedSidebar =
				allAddedNodes.filter(
					(addedNode) =>
						addedNode.getAttribute?.("data-element-id") ===
							"selected-chat-item" ||
						addedNode.getAttribute?.("data-element-id") === "custom-chat-item",
				).length === 2 ||
				allAttributeMutatedNodes.some((attrMutatedNode) => {
					if (
						attrMutatedNode.target.getAttribute?.("data-element-id") ===
						"nav-container"
					) {
						return (
							attrMutatedNode.attribute === "class" &&
							!attrMutatedNode.attributes
								.get("class")
								?.includes("translate-x-[-100%] opacity-0")
						);
					}
					return false;
				});
			// also data-element-id=main-content-adea class changes to:
			// "flex flex-1 flex-col transition-all duration-300 md:pb-0 md:pl-[--current-sidebar-width]"

			// nav-container 'class' changes. when opening sidebar, it's:
			// z-[60] transition duration-300 fixed w-full pb-[--workspace-height] md:pb-0 bottom-0 left-0 md:w-[--sidebar-width] bottom-0 top-0

			// nav-handler 'class' changes. when opening sidebar, it's "z-[60] transition duration-300 fixed w-full pb-[--workspace-height] md:pb-0 bottom-0 left-0 md:w-[--sidebar-width] bottom-0 top-0".
			if (openedSidebar) {
				console.log(`🎯 Sidebar was just opened (mutation).`);
				console.assert(
					!PageState.sideBarOpen,
					"Saw selected-chat-item but sideBarOpen was already true",
				);
				PageState.sideBarOpen = true;
				PageState.inChat = false;
				onSidebarOpen?.();
				return;
			}

			const enteredChat =
				allAddedNodes.some(
					(addedNode) =>
						// only attributes are interesting, not existence.
						addedNode.getAttribute?.("data-element-id") ===
							"chat-input-textbox" ||
						!addedNode.getAttribute?.("data-element-id") === "nav-handler",
				) ||
				// This is true only when COMING BACK to a chat from sidebar
				allAttributeMutatedNodes.some((attrMutatedNode) => {
					if (
						attrMutatedNode.target.getAttribute?.("data-element-id") ===
						"nav-container"
					) {
						return (
							attrMutatedNode.attribute === "class" &&
							attrMutatedNode.attributes
								.get("class")
								?.includes("translate-x-[-100%] opacity-0")
						);
					}
					return false;
				});

			if (enteredChat) {
				console.log(`🎯 Entering chat (mutation).`);
				PageState.sideBarOpen = false;
				PageState.inChat = true;
				onEnterChat?.();
				return;
			}
		},
	};

	/** Google Gemini skin. */
	function injectCss() {
		const style = document.createElement("style");
		style.textContent = `
  /* --- Chat Styles --- */
  :root {
	--main-dark-color: #1B1C1D;
  }
  main {
    font-family: "Google Sans Display", sans-serif;
    line-height: 1.75rem;  /* translates to 28px, which is 16px*1.75. But using font-size 15px, this should be a little lower */
    font-size: 15px;
    background-color: #1B1C1D !important;
    color: white;
  }
  code, kbd, pre, samp {
	font-family: "Google Sans Mono", "Google Sans Code", "Fira Code Nerd Font", monospace;
  }
  code.inline, kbd.inline, pre.inline, samp.inline {
    background-color: rgba(194, 192, 182, 0.05) !important;
    border-color: rgba(222, 220, 209, 0.15) !important;
    border-style: solid;
    border-width: 0.5px !important;
    color: rgb(232, 107, 107);
  }
  .text-sm, .prose-sm {
    font-size: 15px;
  }
  .dark\:bg-\[--main-dark-color\]:is(.dark *) {
	background-color: #1B1C1D;
  }
  div[data-element-id="chat-avatar-container"] {
  	display: none;
  }
	
  div[data-element-id="sidebar-middle-part"]{
    background-color: #282A2C;
    color: rgb(211, 227, 253);
    font-size: 14px;
  }

  div[data-element-id="user-message"]{
    background-color: #333537;
	padding: 12px 16px;  /* px-4 py-3 */
	border-radius: 24px 4px 24px 24px;  /* remove rounded-[13px]; rounded-2xl rounded-sm */
  }
  div[data-element-id="user-message"], div[data-element-id="ai-response"]{
    line-height: 1.75rem;  /* leading-6 */
  }
  div[role=presentation]{
	border-color: rgb(74, 80, 80);
	border-width: 0.5px;
	box-shadow: 0 2px 8px -2px color(from #a2a9b0 srgb r g b/.16);
	background-color: inherit;
  }
	
  #elements-in-action-buttons{
	display: none;
  }
  `;
		document.head.appendChild(style);
	}

	onPageSettled(() => {
		console.log("[main] The page is now fully loaded and interactive!");
		injectCss();
		Sidebar.close();

		// Note the coupling and potential race condition between this block, which is called once on load, and the body observer callback.
		if (PageState.inferFromDom().inChat) {
			console.log("[main] 🎯 In chat (inferred from DOM).");
			SaveChat.addSaveChatButton();
			// StopButton.addStopButton();
			ChatMessages.removeHoverClasses();
			ChatMessages.makeAlignedAndLessWide();
			InputBox.mergeButtonRows();
		}

		const bodyObserver = new MutationObserver((mutations) => {
			bodyObserver.disconnect();

			PageState.inferFromMutationsInplace(mutations, {
				onEnterChat: () => {
					SaveChat.addSaveChatButton();
					// StopButton.addStopButton();
					improveChatUsability(mutations);
					InputBox.mergeButtonRows();
				},
			});

			
			bodyObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			});
		});
		bodyObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		});
	});
})();
