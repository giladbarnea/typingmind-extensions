/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <explanation> */
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
		'div[data-element-id=pop-up-modal] input[placeholder="Enter your email"]'
	]
	
	// Combined selector for child-based approach
	const BuyModalChildSelector = BuyModalChildSelectors.join(', ')
	
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
	console.log("🎯 Modal Selectors Initialized:")
	console.log("  Original (strict hierarchy):", BuyModalSelector)
	console.log("  Loose hierarchy:", BuyModalSelectorLoose) 
	console.log("  Child-based:", BuyModalChildSelector)

	// #region ---[ Modal Debug Observer ]---
	/**
	 * Debug observer to catch modal appearances that the main observer might miss
	 */
	function createModalDebugObserver() {
		console.log("🔍 Setting up debug observer for modal detection...")
		
		const debugObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				// Log all added nodes
				if (mutation.addedNodes.length > 0) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check for any modal-like elements
							const isModal = node.matches && (
								node.matches('[data-element-id*="modal"]') ||
								node.matches('[data-element-id*="pop-up"]') ||
								node.matches('div[role="dialog"]') ||
								node.matches('div[aria-modal="true"]') ||
								node.matches('.modal') ||
								node.className?.includes?.('modal') ||
								node.textContent.includes('upgrade') ||
								node.textContent.includes('buy') ||
								node.querySelector('a[href*="buy.typingmind.com"]') ||
								node.querySelector('input[placeholder*="email"]')
							)
							
							if (isModal) {
								console.log("🚨 DEBUG: Potential modal detected!", {
									type: "addedNode",
									element: node,
									selector: node.getAttribute('data-element-id'),
									className: node.className,
									textContent: node.textContent?.substring(0, 100),
									hasUpgradeLink: !!node.querySelector('a[href*="buy.typingmind.com"]'),
									hasEmailInput: !!node.querySelector('input[placeholder*="email"]'),
									mutation: mutation
								})
							}
							
							// Test all three selector approaches
							const testAllSelectors = (node) => {
								const results = {
									original: node.querySelectorAll && node.querySelectorAll(BuyModalSelector),
									loose: node.querySelectorAll && node.querySelectorAll(BuyModalSelectorLoose),
									childBased: node.querySelectorAll && node.querySelectorAll(BuyModalChildSelector)
								}
								
								let foundAny = false
								Object.entries(results).forEach(([selectorType, matches]) => {
									if (matches && matches.length > 0) {
										foundAny = true
										console.log(`🚨 DEBUG: Modal found via ${selectorType} selector!`, {
											type: "childModal",
											selectorType: selectorType,
											parent: node,
											modals: matches,
											mutation: mutation
										})
									}
								})
								
								return foundAny
							}
							
							testAllSelectors(node)
						}
					}
				}
				
				// Log attribute changes that might affect visibility
				if (mutation.type === 'attributes') {
					const target = mutation.target
					if (target.nodeType === Node.ELEMENT_NODE) {
						const isModalRelated = target.matches && (
							target.matches('[data-element-id*="modal"]') ||
							target.matches('[data-element-id*="pop-up"]') ||
							target.className?.includes?.('modal') ||
							target.getAttribute('data-element-id') === 'pop-up-modal'
						)
						
						if (isModalRelated) {
							console.log("🔄 DEBUG: Modal-related attribute change!", {
								type: "attributeChange",
								element: target,
								attributeName: mutation.attributeName,
								oldValue: mutation.oldValue,
								newValue: target.getAttribute(mutation.attributeName),
								mutation: mutation
							})
						}
						
						// Check for visibility/display changes
						if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
							const computedStyle = window.getComputedStyle(target)
							if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden' && computedStyle.opacity !== '0') {
								// Check if this element or its children contain modal content
								const containsModalContent = target.textContent.includes('upgrade') || 
															target.textContent.includes('buy') ||
															target.querySelector('a[href*="buy.typingmind.com"]') ||
															target.querySelector('input[placeholder*="email"]')
								
								if (containsModalContent) {
									console.log("👁️ DEBUG: Element with modal content became visible!", {
										type: "visibilityChange",
										element: target,
										attributeName: mutation.attributeName,
										textContent: target.textContent?.substring(0, 100),
										mutation: mutation
									})
								}
							}
						}
					}
				}
			}
		})
		
		// Observe with comprehensive settings
		debugObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeOldValue: true,
			characterData: true,
			characterDataOldValue: true
		})
		
		console.log("🔍 Debug observer active - will log any modal-related changes")
		
		return debugObserver
	}

	// Start debug observer
	const modalDebugObserver = createModalDebugObserver()

	// #endregion Modal Debug Observer

	// #region ---[ Intersection Observer Fallback ]---
	/**
	 * Fallback observer using Intersection Observer API to detect modals becoming visible
	 */
	function createIntersectionObserverFallback() {
		console.log("👁️ Setting up Intersection Observer fallback for modal detection...")
		
		const intersectionObserver = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.intersectionRatio > 0) {
					const element = entry.target
					
					// Check if this is a modal that just became visible
					const isModal = element.matches && (
						element.matches(BuyModalSelector) ||
						element.matches('[data-element-id*="modal"]') ||
						element.matches('[data-element-id*="pop-up"]') ||
						element.matches('div[role="dialog"]') ||
						element.matches('div[aria-modal="true"]') ||
						element.className?.includes('modal')
					)
					
					const containsModalContent = element.textContent.includes('upgrade') || 
												element.textContent.includes('buy') ||
												element.querySelector('a[href*="buy.typingmind.com"]') ||
												element.querySelector('input[placeholder*="email"]')
					
					if (isModal || containsModalContent) {
						console.log("👁️ INTERSECTION: Modal became visible in viewport!", {
							element: element,
							selector: element.getAttribute('data-element-id'),
							className: element.className,
							textContent: element.textContent?.substring(0, 100),
							intersectionRatio: entry.intersectionRatio,
							boundingClientRect: entry.boundingClientRect
						})
						
						// Try to close the modal
						if (element.matches(BuyModalSelector)) {
							console.log("🔥 INTERSECTION: Attempting to close detected buy modal...")
							element.remove()
						}
					}
				}
			}
		}, {
			root: null, // viewport
			rootMargin: '0px',
			threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for better detection
		})
		
		// Observe all existing elements that might be modals
		const observeExistingModals = () => {
			const potentialModals = document.querySelectorAll(`
				[data-element-id*="modal"],
				[data-element-id*="pop-up"],
				div[role="dialog"],
				div[aria-modal="true"],
				.modal,
				${BuyModalSelector}
			`)
			
			potentialModals.forEach(modal => {
				intersectionObserver.observe(modal)
			})
			
					console.log(`👁️ INTERSECTION: Observing ${potentialModals.length} existing potential modals`)
	}
	
	// Set up a mutation observer specifically to watch for new potential modals to observe
	const modalWatcher = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Check if this new node is a potential modal
						const isPotentialModal = node.matches && (
							node.matches('[data-element-id*="modal"]') ||
							node.matches('[data-element-id*="pop-up"]') ||
							node.matches('div[role="dialog"]') ||
							node.matches('div[aria-modal="true"]') ||
							node.matches('.modal') ||
							node.className?.includes?.('modal')
						)
						
						if (isPotentialModal) {
							console.log("👁️ INTERSECTION: New potential modal detected, adding to observation list")
							intersectionObserver.observe(node)
						}
						
						// Also check for child modals
						const childModals = node.querySelectorAll && node.querySelectorAll(`
							[data-element-id*="modal"],
							[data-element-id*="pop-up"],
							div[role="dialog"],
							div[aria-modal="true"],
							.modal
						`)
						
						if (childModals && childModals.length > 0) {
							console.log(`👁️ INTERSECTION: Found ${childModals.length} child modals, adding to observation`)
							childModals.forEach(modal => intersectionObserver.observe(modal))
						}
					}
				}
			}
		}
	})
	
	modalWatcher.observe(document.body, {
		childList: true,
		subtree: true
	})
	
	// Start observing existing modals
	observeExistingModals()
	
	console.log("👁️ Intersection Observer fallback active")
		
		return { intersectionObserver, modalWatcher }
	}

	// Start intersection observer fallback
	// const intersectionFallback = createIntersectionObserverFallback()

	// #endregion Intersection Observer Fallback

	// #region ---[ Periodic Modal Check ]---
	/**
	 * Periodic check for modals as a final safety net
	 */
	function setupPeriodicModalCheck() {
		console.log("⏰ Setting up periodic modal check...")
		
		const checkForModals = () => {
			// Check for buy modals using all selector approaches
			const selectorTests = [
				{ name: "original", selector: BuyModalSelector },
				{ name: "loose", selector: BuyModalSelectorLoose },
				{ name: "child", selector: BuyModalChildSelector }
			]
			
			let totalModalsFound = 0
			const processedNodes = new Set()
			
			selectorTests.forEach(({ name, selector }) => {
				const buyModals = document.querySelectorAll(selector)
				if (buyModals.length > 0) {
					console.log(`⏰ PERIODIC: Found ${buyModals.length} buy modals via ${name} selector!`, {
						selector: selector,
						modals: buyModals
					})
					
					buyModals.forEach((modal, index) => {
						// Avoid duplicate removals
						let nodeToRemove = modal
						
						// For child-based selector, find the modal container
						if (name === "child") {
							const modalContainer = modal.closest('div[data-element-id=pop-up-modal]')
							if (modalContainer) {
								nodeToRemove = modalContainer
							}
						}
						
						if (!processedNodes.has(nodeToRemove)) {
							processedNodes.add(nodeToRemove)
							console.log(`⏰ PERIODIC: Removing modal ${index + 1}/${buyModals.length} via ${name} selector`)
							nodeToRemove.remove()
							totalModalsFound++
						}
					})
				}
			})
			
			// Check for buy buttons
			const buyButtons = document.querySelectorAll(BuyButtonSelector)
			if (buyButtons.length > 0) {
				console.log("⏰ PERIODIC: Found buy buttons during periodic check!", {
					count: buyButtons.length,
					buttons: buyButtons
				})
				
				buyButtons.forEach((button, index) => {
					console.log(`⏰ PERIODIC: Removing buy button ${index + 1}/${buyButtons.length}`)
					button.remove()
				})
			}
			
			// Check for any other modal-like elements with upgrade/buy content
			const allModalElements = document.querySelectorAll(`
				[data-element-id*="modal"],
				[data-element-id*="pop-up"],
				div[role="dialog"],
				div[aria-modal="true"],
				.modal
			`)
			
			allModalElements.forEach((element) => {
				const hasUpgradeContent = element.textContent.includes('upgrade') ||
										element.textContent.includes('buy') ||
										element.querySelector('a[href*="buy.typingmind.com"]') ||
										element.querySelector('input[placeholder*="email"]')
				
				if (hasUpgradeContent) {
					console.log("⏰ PERIODIC: Found modal with upgrade content during periodic check!", {
						element: element,
						selector: element.getAttribute('data-element-id'),
						textContent: element.textContent?.substring(0, 100)
					})
					
					element.remove()
				}
			})
		}
		
		// Check every 2 seconds
		const intervalId = setInterval(checkForModals, 2000)
		
		// Also check immediately
		setTimeout(checkForModals, 1000)
		
		console.log("⏰ Periodic modal check active (every 2 seconds)")
		
		return intervalId
	}

	// Start periodic check
	// const periodicCheckInterval = setupPeriodicModalCheck()

	// #endregion Periodic Modal Check

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
		/**
		 * Checks all node-containing properties of MutationRecord and returns ones that match.
		 * @returns a list of objects, each object is a thin wrapper for a matching node: { node: matchingNode, type: "addedNode" }, { node: matchingNode, type: "target" }, etc
		 */
		const mutatedMatches = (mutation, selector) => {
			const matches = []
			let anyMatches = false
			for (const addedNode of mutation.addedNodes || []) {
				if (addedNode.matches?.(selector)) {
					matches.push({ node: addedNode, type: "addedNode" })
					anyMatches = true
				}
				// Also check children of added nodes
				if (addedNode.querySelectorAll) {
					const childMatches = addedNode.querySelectorAll(selector)
					for (const childMatch of childMatches) {
						matches.push({ node: childMatch, type: "addedNodeChild" })
						anyMatches = true
					}
				}
			}
			for (const removedNode of mutation.removedNodes || []) {
				if (removedNode.matches?.(selector)) {
					matches.push({ node: removedNode, type: "removedNode" })
					anyMatches = true
				}
			}
			if (mutation.target?.matches?.(selector)) {
				matches.push({ node: mutation.target, type: "target" })
				anyMatches = true
			}
			if (mutation.nextSibling?.matches?.(selector)) {
				matches.push({ node: mutation.nextSibling, type: "nextSibling" })
				anyMatches = true
			}
			if (mutation.previousSibling?.matches?.(selector)) {
				matches.push({ node: mutation.previousSibling, type: "previousSibling" })
				anyMatches = true
			}
			return { matches, anyMatches }
		}
		
		for (const mutation of mutations) {
			// Enhanced buy button detection
			let { matches, anyMatches } = mutatedMatches(mutation, BuyButtonSelector)
			if (anyMatches) {
				console.log("🎯 MAIN: Buy button detected. Removing it.", { matches })
				matches.forEach(({ node }) => {
					if (node && node.remove) {
						node.remove()
					}
				})
			}
			
			// Enhanced buy modal detection - test all selector approaches
			const testAllModalSelectors = (mutation) => {
				const selectorTests = [
					{ name: "original", selector: BuyModalSelector },
					{ name: "loose", selector: BuyModalSelectorLoose },
					{ name: "childBased", selector: BuyModalChildSelector }
				]
				
				let totalMatches = []
				
				selectorTests.forEach(({ name, selector }) => {
					const { matches, anyMatches } = mutatedMatches(mutation, selector)
					if (anyMatches) {
						console.log(`🎯 MAIN: Buy modal detected via ${name} selector!`, { matches, selector })
						totalMatches.push(...matches)
					}
				})
				
				// Remove duplicates and clean up
				const uniqueNodes = new Set()
				totalMatches.forEach(({ node }) => {
					if (node && node.remove && !uniqueNodes.has(node)) {
						uniqueNodes.add(node)
						
						// For child-based selector, we need to find and remove the modal container
						if (node.closest && node.closest('div[data-element-id=pop-up-modal]')) {
							const modalContainer = node.closest('div[data-element-id=pop-up-modal]')
							console.log("🎯 MAIN: Removing modal container found via child selector")
							modalContainer.remove()
						} else {
							node.remove()
						}
					}
				})
				
				return totalMatches.length > 0
			}
			
			testAllModalSelectors(mutation)
			
			// Additional modal detection methods
			if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
				for (const addedNode of mutation.addedNodes) {
					if (addedNode.nodeType === Node.ELEMENT_NODE) {
						// Check for modals using broader criteria with all selector approaches
						const testAllApproaches = () => {
							const tests = [
								{ name: "original-direct", result: addedNode.matches?.(BuyModalSelector) },
								{ name: "loose-direct", result: addedNode.matches?.(BuyModalSelectorLoose) },
								{ name: "child-direct", result: addedNode.matches?.(BuyModalChildSelector) },
								{ name: "original-query", result: addedNode.querySelector && addedNode.querySelector(BuyModalSelector) },
								{ name: "loose-query", result: addedNode.querySelector && addedNode.querySelector(BuyModalSelectorLoose) },
								{ name: "child-query", result: addedNode.querySelector && addedNode.querySelector(BuyModalChildSelector) },
								{ name: "text-upgrade", result: addedNode.textContent && addedNode.textContent.includes('upgrade') },
								{ name: "link-check", result: addedNode.querySelector && addedNode.querySelector('a[href*="buy.typingmind.com"]') },
								{ name: "email-input", result: addedNode.querySelector && addedNode.querySelector('input[placeholder*="email"]') }
							]
							
							const positiveTests = tests.filter(test => test.result)
							if (positiveTests.length > 0) {
								console.log("🎯 MAIN: Modal detection test results:", {
									element: addedNode,
									positiveTests: positiveTests.map(t => t.name),
									allTests: tests
								})
							}
							
							return positiveTests.length > 0
						}
						
						const isBuyModal = testAllApproaches()
						
						if (isBuyModal) {
							console.log("🎯 MAIN: Buy modal detected via enhanced detection. Closing it.", { 
								element: addedNode,
								textContent: addedNode.textContent?.substring(0, 100)
							})
							
							// Try multiple removal strategies with all selector approaches
							const removeModal = () => {
								// Strategy 1: Direct removal if node is a modal
								if (addedNode.matches?.(BuyModalSelector) || 
									addedNode.matches?.(BuyModalSelectorLoose)) {
									console.log("🎯 MAIN: Removing modal directly")
									addedNode.remove()
									return true
								}
								
								// Strategy 2: Find modal container and remove it
								const modalSelectors = [BuyModalSelector, BuyModalSelectorLoose]
								for (const selector of modalSelectors) {
									const modalElement = addedNode.querySelector(selector)
									if (modalElement) {
										console.log(`🎯 MAIN: Removing modal found via querySelector: ${selector}`)
										modalElement.remove()
										return true
									}
								}
								
								// Strategy 3: Child-based - find child and remove its modal container
								const childElement = addedNode.querySelector(BuyModalChildSelector)
								if (childElement) {
									const modalContainer = childElement.closest('div[data-element-id=pop-up-modal]')
									if (modalContainer) {
										console.log("🎯 MAIN: Removing modal container found via child element")
										modalContainer.remove()
										return true
									}
								}
								
								// Strategy 4: Fallback - send escape key
								console.log("🎯 MAIN: Using escape key fallback")
								setTimeout(() => {
									document.dispatchEvent(new KeyboardEvent("keydown", { 
										key: "Escape", 
										keyCode: 27, 
										bubbles: true 
									}))
								}, 25)
								return false
							}
							
							removeModal()
						}
					}
				}
			}
			
			// Handle attribute changes that might show modals
			if (mutation.type === "attributes") {
				const target = mutation.target
				if (target && target.nodeType === Node.ELEMENT_NODE) {
					// Check if a modal became visible through attribute changes
					if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
						const modalTests = [
							{ name: "original-direct", result: target.matches?.(BuyModalSelector) },
							{ name: "loose-direct", result: target.matches?.(BuyModalSelectorLoose) },
							{ name: "original-query", result: target.querySelector && target.querySelector(BuyModalSelector) },
							{ name: "loose-query", result: target.querySelector && target.querySelector(BuyModalSelectorLoose) },
							{ name: "child-query", result: target.querySelector && target.querySelector(BuyModalChildSelector) }
						]
						
						const positiveTests = modalTests.filter(test => test.result)
						const isBuyModal = positiveTests.length > 0
						
						if (isBuyModal) {
							const computedStyle = window.getComputedStyle(target)
							const isVisible = computedStyle.display !== 'none' && 
											computedStyle.visibility !== 'hidden' && 
											computedStyle.opacity !== '0'
							
							if (isVisible) {
								console.log("🎯 MAIN: Buy modal became visible via attribute change. Closing it.", {
									element: target,
									attributeName: mutation.attributeName,
									detectedVia: positiveTests.map(t => t.name)
								})
								
								// Try all removal approaches
								if (target.matches?.(BuyModalSelector) || target.matches?.(BuyModalSelectorLoose)) {
									target.remove()
								} else {
									// Try to find modal via different selectors
									const modalElement = target.querySelector(BuyModalSelector) || 
														target.querySelector(BuyModalSelectorLoose)
									if (modalElement) {
										modalElement.remove()
									} else {
										// Child-based approach
										const childElement = target.querySelector(BuyModalChildSelector)
										if (childElement) {
											const modalContainer = childElement.closest('div[data-element-id=pop-up-modal]')
											if (modalContainer) {
												modalContainer.remove()
											}
										}
									}
								}
							}
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
			
			// Enhanced buy button target detection
			if (target?.matches?.(BuyButtonSelector)) {
				console.log("🎯 MAIN: Buy button target detected. Removing it.")
				target.remove()
			}

			// Legacy modal detection (keeping for backward compatibility)
			if ([...mutation.addedNodes].some((node) => node.matches?.(BuyModalSelector))) {
				console.log("🎯 MAIN: Upgrade modal detected via legacy method. Closing it.")
				setTimeout(() => {
					document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
				}, 25)
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
