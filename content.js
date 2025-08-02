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

;(function () {
	// Your code here...

	// --- Configuration ---
	const BuyModalSelector = `div[data-element-id=pop-up-modal]
	:not(
		:has(
			> div > div > div > form > input[data-element-id=plugin-url-input]
		),
		:has(
			> div > div > div > form > input[data-element-id=plugin-url-input]
		)
	)`
	const BuyButtonSelector = "button#nav-buy-button"
	const ButtonContainerSelector = 'div[data-element-id="current-chat-title"] > div'
	const SaveJsonButtonId = "save-json-button"
	const SidebarSelector = 'div[data-element-id="nav-container"]'
	const isSidebarOpen = () => !document.querySelector(SidebarSelector).matches(".opacity-0")
	const ResponseBlockSelector = 'div[data-element-id=response-block]'

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

	function saveButtonExists() {
		return !!document.getElementById(SaveJsonButtonId)
	}

	// #endregion Save Chat
	
	function removeHoverClasses(node){
		const responseBlock = node.matches(ResponseBlockSelector) ? node : null
		if (responseBlock) {
			responseBlock.classList.remove('hover:bg-slate-50', 'dark:hover:bg-white/5')
		}
	}

	// --- Main Logic ---
	console.log("Extension: Content script loaded and observing DOM.")

	// #region ---[ Body Observer ]---

	/**
	 * Modifies elements in the DOM.
	 * @param {MutationRecord[]} mutations - The mutations to process.
	 * @param {string} BuyButtonSelector - The selector for the buy button.
	 * @param {string} BuyModalSelector - The selector for the buy modal.
	*/
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: noise
	function modifyElements(mutations, BuyButtonSelector, BuyModalSelector) {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				// We only care about element nodes.
				if (node.nodeType !== 1) continue

				// Buy button
				const buyButton = node.matches(BuyButtonSelector) ? node : node.querySelector(BuyButtonSelector)
				if (buyButton) {
					console.log("Extension: Buy button detected. Removing it.")
					buyButton.remove()
				}

				// Buy modal
				const buyModal = node.matches(BuyModalSelector) ? node : node.querySelector(BuyModalSelector)
				if (buyModal) {
					console.log("Extension: Upgrade modal detected. Closing it.")
					setTimeout(() => {
						document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
					}, 25)
				}
				
				// Remove hover classes from response block
				removeHoverClasses(node)
			}
		}
	}

	const bodyObserver = new MutationObserver((mutations) => {
		// Add our custom button when its container appears.
		addSaveButton() // Assumes function is idempotent.

		modifyElements(mutations, BuyButtonSelector, BuyModalSelector)
	})
	bodyObserver.observe(document.body, { childList: true, subtree: true })
	// #endregion Body Observer

	// #region ---[ CSS ]---
	function injectCss() {
		const style = document.createElement("style")
		style.textContent = `
  /* --- Chat Styles --- */
  
  main {
    font-family: "Google Sans Display", sans-serif;
    line-height: 28px;
    font-size: 16px;
    background-color: #1B1C1D;
    color: white;
  }
  code, kbd, pre, samp {
    font-family: "Fira Code Nerd Font", monospace;
  }
  code.inline, kbd.inline, pre.inline, samp.inline {
    background-color: rgba(194, 192, 182, 0.05) !important;
    border-color: rgba(222, 220, 209, 0.15) !important;
    border-style: solid;
    border-width: 0.5px !important;
    color: rgb(232, 107, 107);
  }
    
  div[data-element-id="sidebar-middle-part"]{
    background-color: #282A2C;
    color: rgb(211, 227, 253);
    font-size: 14px;

  }
  `
		document.head.appendChild(style)
	}
	injectCss()


	// #endregion CSS

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
			childList: true, // observe direct children additions/removals
			subtree: true, // observe all descendants, not just children
			attributes: true, // observe attribute changes
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

	// --- How to use it ---

	onPageSettled(() => {
		console.log("The page is now fully loaded and interactive!")
		// Your code here. For example, run a tutorial, show a popup, etc.
		if (isSidebarOpen()) {
			document.querySelector('button[aria-label="Open sidebar"]').click()
		}
		
		document.querySelectorAll(ResponseBlockSelector).forEach(removeHoverClasses)
	})

})()
