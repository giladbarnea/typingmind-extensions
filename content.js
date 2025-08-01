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
				> div > div > div > div > div.flex:has(> button:nth-of-type(2))
			)
	)`
	const BuyButtonSelector = "button#nav-buy-button"
	const ButtonContainerSelector = 'div[data-element-id="current-chat-title"] > div'
	const SaveJsonButtonId = "save-json-button"

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
		if (!buttonContainer || document.getElementById(SaveJsonButtonId)) {
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

	// --- Main Logic ---
	console.log("Extension: Content script loaded and observing DOM.")

	// This observer handles adding our custom button when its container appears.
	const buttonObserver = new MutationObserver((mutations, obs) => {
		if (document.querySelector(ButtonContainerSelector)) {
			addSaveButton()
			obs.disconnect() // We only need to add the button once.
		}
	})
	buttonObserver.observe(document.body, { childList: true, subtree: true })

	// This observer handles removing unwanted elements whenever they are added to the DOM.
	const removalObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				// We only care about element nodes.
				if (node.nodeType !== 1) continue

				// Check for the buy button
				const buyButton = node.matches(BuyButtonSelector) ? node : node.querySelector(BuyButtonSelector)
				if (buyButton) {
					console.log("Extension: Buy button detected. Removing it.")
					buyButton.remove()
				}

				// Check for the buy modal
				const buyModal = node.matches(BuyModalSelector) ? node : node.querySelector(BuyModalSelector)
				if (buyModal) {
					console.log("Extension: Upgrade modal detected. Closing it.")
					setTimeout(() => {
						document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
					}, 250)
				}
			}
		}
	})
	removalObserver.observe(document.body, { childList: true, subtree: true })

	// ----[ Styling / CSS on page load ]----
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
})()
