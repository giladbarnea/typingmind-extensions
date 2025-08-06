/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: because */
// ==UserScript==
// @name         Typingmind: Save Chat, Remove Buy Modal/Button, Better Fonts
// @namespace    http://tampermonkey.net/
// @version      2025-08-01
// @description  Typingmind: Save Chat, Remove Buy Modal/Button, Better Fonts
// @author       You
// @match        https://www.typingmind.com/*
// @icon         https://www.typingmind.com/favicon-192x192.png
// @grant        none
// ==/UserScript==

;(() => {
	// Your code here...

	// --- Configuration ---
	// const BuyModalSelector = `div[data-element-id=pop-up-modal]
	// :not(
	// 	:has(
	// 		> div > div > div > form > input[data-element-id=plugin-url-input]
	// 	),
	// 	:has(
	// 		> div > div > div > div > div.flex > button:nth-of-type(2)
	// 	)
	// )`
	const BuyModalSelector = `div[data-element-id=pop-up-modal]
	:has(
		a[href*="https://buy.typingmind.com"], 
		 > div > form > div > input[placeholder="Enter your email"]
	)`

	// Alternative selector versions for testing different approaches
	// Version 1: Looser hierarchy - doesn't require direct children, just descendants
	const BuyModalSelectorLoose = `div[data-element-id=pop-up-modal]
	:has(
		a[href*="https://buy.typingmind.com"], 
		input[placeholder="Enter your email"]
	)`

	// Version 2: Select the child elements directly instead of the modal container
	const BuyModalChildSelectors = [
		'div[data-element-id=pop-up-modal] a[href*="https://buy.typingmind.com"]',
		'div[data-element-id=pop-up-modal] input[placeholder="Enter your email"]',
	]

	// Combined selector for child-based approach
	const BuyModalChildSelector = BuyModalChildSelectors.join(", ")

	const BuyButtonSelector = "button#nav-buy-button"
	const ButtonContainerSelector = 'div[data-element-id="current-chat-title"] > div'
	const SaveJsonButtonId = "save-json-button"
	const StopButtonId = "stop-button"
	const SidebarSelector = 'div[data-element-id="nav-container"]'
	const isSidebarOpen = () => !document.querySelector(SidebarSelector).matches(".opacity-0")
	const closeSidebar = () => document.querySelector('button[aria-label="Open sidebar"]').click()
	const ResponseBlockSelector = "div[data-element-id=response-block]"
	const UserMessageSelector = "div[data-element-id=user-message]"
	const AiResponseSelector = "div[data-element-id=ai-response]"

	// #region ---[ Save Chat ]---
	// --- IndexedDB Configuration ---
	const DbName = "keyval-store"
	const StoreName = "keyval"

	// --- Utility Functions ---
	function getFromIndexedDb(dbName, storeName, key) {
		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(dbName)
			request.onerror = () => reject(new Error(`Failed to open IndexedDB: ${dbName}`))
			request.onsuccess = (event) => {
				const db = event.target.result
				if (!db.objectStoreNames.contains(storeName)) {
					return reject(new Error(`Store "${storeName}" not found in DB "${dbName}"`))
				}
				const transaction = db.transaction([storeName], "readonly")
				const store = transaction.objectStore(storeName)
				const getRequest = store.get(key)
				getRequest.onsuccess = () => resolve(getRequest.result)
				getRequest.onerror = () => reject(new Error(`Failed to retrieve data from store: ${storeName}`))
			}
			request.onupgradeneeded = () => console.warn("Database upgrade needed or creation started.")
		})
	}

	function triggerDownload(filename, data) {
		const blob = new Blob([data], { type: "application/json" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	/**
	 * Creates and injects the "Save Chat" button into the DOM.
	 */
	function addSaveButton() {
		const buttonContainer = document.querySelector(ButtonContainerSelector)
		if (!buttonContainer || saveButtonExists()) {
			return
		}

		console.log('Extension: Button container found. Adding "Save" button.')

		const saveButton = document.createElement("button")
		saveButton.id = SaveJsonButtonId
		saveButton.className =
			"w-9 justify-center dark:hover:bg-white/20 dark:active:bg-white/25 dark:disabled:text-neutral-500 hover:bg-slate-900/20 active:bg-slate-900/25 disabled:text-neutral-400 focus-visible:outline-offset-2 focus-visible:outline-slate-500 text-slate-900 dark:text-white inline-flex items-center rounded-lg h-9 transition-all group font-semibold text-xs"
		saveButton.setAttribute("data-tooltip-id", "global")
		saveButton.setAttribute("data-tooltip-content", "Save Chat as JSON")

		const saveIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		saveIcon.setAttribute("class", "w-[18px] h-[18px]")
		saveIcon.setAttribute("viewBox", "0 0 24 24")
		saveIcon.setAttribute("fill", "none")
		saveIcon.setAttribute("stroke", "currentColor")
		saveIcon.setAttribute("stroke-width", "1.5")
		saveIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />`
		saveButton.appendChild(saveIcon)

		saveButton.addEventListener("click", async () => {
			const url = window.location.href
			const match = url.match(/#chat=([^&]+)/)
			if (!match) {
				alert("Could not find a chat ID in the URL.")
				return
			}
			const chatId = match[1]

			console.log(`Attempting to fetch chat "${chatId}" to save it...`)
			try {
				const value = await getFromIndexedDb(DbName, StoreName, `CHAT_${chatId}`)
				if (value === undefined) {
					alert(`No value found for key: "CHAT_${chatId}"`)
					return
				}

				console.log("SUCCESS: Found value. Triggering download...")
				const jsonString = JSON.stringify(value, null, 2)

				const now = new Date()
				const year = now.getFullYear().toString().slice(-2)
				const month = (now.getMonth() + 1).toString().padStart(2, "0")
				const day = now.getDate().toString().padStart(2, "0")
				const hours = now.getHours().toString().padStart(2, "0")
				const minutes = now.getMinutes().toString().padStart(2, "0")
				const seconds = now.getSeconds().toString().padStart(2, "0")

				const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`
				const filename = `${timestamp}-${chatId}.json`

				triggerDownload(filename, jsonString)
			} catch (error) {
				console.error("ERROR: Failed to access IndexedDB.", error)
				alert("Error accessing IndexedDB. See console for details.")
			}
		})

		buttonContainer.prepend(saveButton)
	}

	/**
	 * Creates the "Stop" button for stopping LLM streaming.
	 */
	function addStopButton() {
		const stopButton = document.createElement("button")
		stopButton.id = StopButtonId
		stopButton.className =
			"w-9 justify-center dark:hover:bg-white/20 dark:active:bg-white/25 dark:disabled:text-neutral-500 hover:bg-slate-900/20 active:bg-slate-900/25 disabled:text-neutral-400 focus-visible:outline-offset-2 focus-visible:outline-slate-500 text-slate-900 dark:text-white inline-flex items-center rounded-lg h-9 transition-all group font-semibold text-xs"
		stopButton.setAttribute("data-tooltip-id", "global")
		stopButton.setAttribute("data-tooltip-content", "Stop Generating")

		const stopIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		stopIcon.setAttribute("class", "w-[18px] h-[18px]")
		stopIcon.setAttribute("viewBox", "0 0 24 24")
		stopIcon.setAttribute("fill", "currentColor")
		stopIcon.innerHTML = `<path d="M5 5h14v14H5z" />`
		stopButton.appendChild(stopIcon)
	}

	function saveButtonExists() {
		return !!document.getElementById(SaveJsonButtonId)
	}

	// #endregion Save Chat

	// #region ---[ Element Modifications ]---
	function removeHoverClasses(node) {
		if (node) {
			node.classList.remove("hover:bg-slate-50", "dark:hover:bg-white/5")
		} else {
			document.querySelectorAll(ResponseBlockSelector).forEach(removeHoverClasses)
		}
	}

	function makeMessagesAlignedAndLessWide(node) {
		const chatContentContainer = document.querySelector("div.dynamic-chat-content-container")
		if (!chatContentContainer.classList.contains("max-w-3xl", "mx-auto")) {
			chatContentContainer.classList.add("max-w-3xl", "mx-auto")
		}

		const shrinkUserMessage = (userMsgResponseBlock) => {
			;["ml-auto", "mr-0", "max-w-xl"].forEach((cls) => {
				if (!userMsgResponseBlock.classList.contains(cls))
					userMsgResponseBlock.classList.add("ml-auto", "mr-0", "max-w-xl")
			})

			// Remove the hardcoded max-width style
			userMsgResponseBlock.style["max-width"] = ""
		}
		const shrinkAssistantMessage = (aiMsgResponseBlock) => {
			// We like mx-auto because it centers the message, so we don't remove it.
			if (!aiMsgResponseBlock.classList.contains("max-w-xl")) aiMsgResponseBlock.classList.add("max-w-xl")

			aiMsgResponseBlock.style["max-width"] = ""
		}
		if (node?.matches(`${ResponseBlockSelector}:has(>div>div>${UserMessageSelector})`)) {
			shrinkUserMessage(node)
		} else if (node?.matches(`${ResponseBlockSelector}:has(>div>${AiResponseSelector})`)) {
			shrinkAssistantMessage(node)
		} else {
			document
				.querySelectorAll(`${ResponseBlockSelector}:has(>div>div>${UserMessageSelector})`)
				.forEach(shrinkUserMessage)
			document
				.querySelectorAll(`${ResponseBlockSelector}:has(>div>${AiResponseSelector})`)
				.forEach(shrinkAssistantMessage)
		}
	}

	function improveMessageTypography(node) {
		// (node||document).querySelectorAll(`${UserMessageSelector}, ${AiResponseSelector}`).forEach((message) => {
		// message.classList.remove("text-sm")
		// })
	}

	function removeAvatars(node) {
		;(node || document).querySelectorAll('div[data-element-id="chat-avatar-container"]').forEach((avatarContainer) => {
			avatarContainer.remove()
		})
	}

	function modifyInputBox() {
		const alreadyModified = document.querySelectorAll('[data-element-id="chat-input-actions"]>div>button').length !== 2
		if (alreadyModified) return

		document.querySelector('div[role="presentation"]').classList.remove("rounded-xl", "dark:bg-slate-950")
		document.querySelector('div[role="presentation"]').classList.add("rounded-3xl")

		// Cut&Paste model and plugin menus under #chat-input-actions>div.justify-start
		const [modelSelector, pluginsMenu] = [
			...document.querySelector('[data-element-id="chat-space-end-part"]').parentElement.querySelectorAll("button"),
		].slice(0, 2)
		const newParent = document.querySelector('[data-element-id="chat-input-actions"]>div')
		modelSelector.querySelectorAll("svg").forEach((svg) => svg.remove())
		pluginsMenu.querySelectorAll("svg").forEach((svg) => svg.remove())
		newParent.appendChild(modelSelector)
		newParent.appendChild(pluginsMenu)
	}

	// #endregion Element Modifications

	// --- Main Logic ---
	console.log("Extension: Content script loaded and observing DOM.")

	// #region ---[ Body Observer ]---

	/**
	 * Executes a callback when the page has "settled" down.
	 * This is useful for modern, reactive websites where content loads asynchronously.
	 *
	 * @param {() => void} callback The function to call when the page is settled.
	 * @param {number} [settleTime=500] The time in milliseconds of inactivity to wait for.
	 * @param {Element} [targetNode=document.body] The DOM element to observe for mutations.
	 */
	function onPageSettled(callback, settleTime = 500, targetNode = document.body) {
		let settleTimer

		// Create an observer instance linked to a callback function
		const observer = new MutationObserver((mutationsList, obs) => {
			// We've detected a mutation, so we clear the existing timer
			clearTimeout(settleTimer)

			// And start a new one
			settleTimer = setTimeout(() => {
				// If this timer completes, it means no mutations have occurred in `settleTime` ms.
				console.log("Page has settled. Firing callback.")

				// We can now disconnect the observer to prevent further checks
				obs.disconnect()

				// And execute the user's callback function
				callback()
			}, settleTime)
		})

		// Configuration for the observer:
		const config = {
			childList: true,
			subtree: true,
			attributes: true,
		}

		// Start observing the target node for configured mutations
		observer.observe(targetNode, config)

		// We also start the initial timer, in case the page is already static
		// or loads faster than the observer can be set up.
		settleTimer = setTimeout(() => {
			console.log("Initial settle time reached. Firing callback.")
			observer.disconnect()
			callback()
		}, settleTime)
	}

	console.log("🎛️ Modal Debug Control: Run 'window.disableModalDebug()' in console to disable debug logging")
	// #endregion Debug Control

	/**
	 * Modifies elements in the DOM.
	 * @param {MutationRecord[]} mutations - The mutations to process.
	 */
	function modifyElements(mutations) {
		let removedModal = false
		for (const mutation of mutations) {
			if (!removedModal && mutation.type === "childList" && mutation.addedNodes.length > 0) {
				for (const addedNode of mutation.addedNodes) {
					if (addedNode.nodeType === Node.ELEMENT_NODE) {
						// Check for modals using broader criteria with all selector approaches
						const testAllApproaches = () => {
							const tests = [
								// { name: "original-direct", result: addedNode.matches?.(BuyModalSelector) },
								// { name: "loose-direct", result: addedNode.matches?.(BuyModalSelectorLoose) },
								// { name: "child-direct", result: addedNode.matches?.(BuyModalChildSelector) },
								// { name: "original-query", result: addedNode.querySelector?.(BuyModalSelector) },
								// { name: "loose-query", result: addedNode.querySelector?.(BuyModalSelectorLoose) },
								// { name: "child-query", result: addedNode.querySelector?.(BuyModalChildSelector) },
								// { name: "text-upgrade", result: addedNode.textContent?.includes?.("upgrade") },
								// { name: "link-check", result: addedNode.querySelector?.(`a[href*="buy.typingmind.com"]`) },
								// { name: "email-input", result: addedNode.querySelector?.(`input[placeholder*="email"]`) },
								{
									name: "popup-modal-child-has-buy-link",
									result: addedNode.querySelector?.(
										"div[data-element-id=pop-up-modal]:has(a[href*='buy.typingmind.com'])",
									),
								},
								{
									name: "popup-modal-child-has-email-input",
									result: addedNode.querySelector?.(
										"div[data-element-id=pop-up-modal]:has(input[placeholder*='email'])",
									),
								},
							]

							const positiveTests = tests.filter((test) => test.result)
							if (positiveTests.length > 0) {
								console.log("🎯 MAIN: Modal detection test results:", {
									element: addedNode,
									positiveTests: positiveTests.map((t) => t.name),
									allTests: tests,
								})
							}

							return tests.filter((t) => !!t.result)
						}

						const matchResults = testAllApproaches()

						if (matchResults.length > 0) {
							console.log("🎯 MAIN: Buy modal detected via enhanced detection. About to close it...", {
								element: addedNode,
								textContent: addedNode.textContent?.substring(0, 100),
							})
							debugger
							// addedNode.remove() // Nuke the root modal provider -> no more modals.
							for (const match of matchResults) {
								match.result.parentElement.remove()
							}
							removedModal = true
							return
						}
					}
				}
			}

			const target = mutation.target
			if (mutation.type === "childList" && target?.matches?.(ResponseBlockSelector)) {
				removeHoverClasses(target)
				makeMessagesAlignedAndLessWide(target)
				removeAvatars(target)
				improveMessageTypography(target)
				modifyInputBox()
			}
		}
	}

	const bodyObserver = new MutationObserver((mutations) => {
		// Add our custom button when its container appears.
		addSaveButton() // Assumes function is idempotent.

		modifyElements(mutations)
	})
	bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
	// #endregion Body Observer

	// #region ---[ CSS ]---
	function injectCss() {
		const style = document.createElement("style")
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
  `
		document.head.appendChild(style)
	}

	// #endregion CSS

	onPageSettled(() => {
		console.log("The page is now fully loaded and interactive!")
		injectCss()
		if (isSidebarOpen()) {
			closeSidebar()
		}

		document.querySelectorAll(ResponseBlockSelector).forEach(removeHoverClasses)

		makeMessagesAlignedAndLessWide()

		removeAvatars()

		improveMessageTypography()

		modifyInputBox()
	})
})()
