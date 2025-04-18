// ==UserScript==
// @name         Stockbit Sentiment Analyzer
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Scrape Stockbit pages and analyze sentiment using ChatGPT API
// @author       Budi
// @match        *://stockbit.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Get your free API key from https://makersuite.google.com/app/apikey
    let apiKey = 'AIzaSyCtbM-TUQO_3NRvWZPKFie2DH5sVT6nv-M';

    // Define the prompt for sentiment analysis
    let sentimentPrompt = `You are a financial analyst specializing in Indonesian stocks (IDX). Analyze the sentiment (bullish/bearish/neutral) based on: Price: [Price] | Price Change: [Price Change] | Volume: [Volume] | Avg Volume: [Avg Volume] | Live Price: [Live Price] | Stream: [Stream]. Provide a concise summary in one paragraph in bahasa indonesia.`;

    // Define the prompt for running trade analysis
    let runningTradePrompt = `You are a financial analyst specializing in Indonesian stocks (IDX). Analyze this running trade data from [emiten] and potential price direction (bullish/bearish/neutral): [Running Trade Data]. Provide a concise summary in one paragraph in bahasa indonesia.`;

    // Define the prompt for broker summary analysis
    let brokerSummaryPrompt = `You are a financial analyst who specializes in Indonesian stock market (IDX). Analyze this broker summary data from [emiten] and potential price direction (bullish/bearish/neutral): [Broker Data]. Provide a concise summary in one paragraph in bahasa indonesia.`;

    // Define the prompt for trade book analysis
    let tradeBookPrompt = `You are a financial analyst who specializes in Indonesian stock market (IDX). Analyze this trade book data from [emiten] and explain the buying/selling pressure and potential price direction (bullish/bearish/neutral): [Trade Book Data]. Provide a concise summary in one paragraph in bahasa indonesia.`;

    // Function to extract data for sentiment analysis
    function extractData() {
        const getText = (selector) => { let element = document.querySelector(selector); return element ? element.innerText.trim() : 'Data not found'; };
        let emiten = getText('h3.sc-f4f9b0e3-8'), harga = getText('div.sc-d08cd954-0.lcNnTo h3.sc-8a078c1d-0'), priceChange = getText('span.orderbook-last-price.up'), volume = getText('h3.sc-8a078c1d-0.cgmnhl');
        let avgVolume = 'Data not found', allVolumes = document.querySelectorAll('h3.sc-8a078c1d-0.cgmnhl');
        if (allVolumes.length > 1) avgVolume = allVolumes[1].innerText.trim();
        let livePrice = getText('table.table-live-price'), stream = getText('div.sc-6b055581-4.kgULIe').replace(/\n+/g, ' ').trim();
        return `Emiten: ${emiten} | Price: ${harga} | Price Change: ${priceChange} | Volume: ${volume} | Avg Volume: ${avgVolume} | Live Price: ${livePrice} | Stream: ${stream}`;
    }

    function extractRunningTradeData() { 
        const getText = (selector) => { let element = document.querySelector(selector); if (!element) return 'Data not found'; let text = element.innerText.trim().replace(/\s+/g, ' ').replace(/\n+/g, ' ').replace(/Filter|Time|Code|Price|Action|Lot|Buyer|Seller/g, '').replace(/\[D\]/g, '').replace(/\s+/g, ' '); return text; }; 
        let emiten = getText('h3.sc-f4f9b0e3-8');
        let runningTrade = getText('#running-trade');
        return runningTrade !== 'Data not found' ? `Emiten: ${emiten} | Running Trade Data: ${runningTrade}` : 'Running Trade Data: Data not found'; 
    }

    function extractBrokerData() { 
        const getText = (selector) => { let element = document.querySelector(selector); if (!element) return 'Data not found'; let text = element.innerText.trim().replace(/\s+/g, ' ').replace(/\n+/g, ' '); return text; }; 
        let emiten = getText('h3.sc-f4f9b0e3-8');
        let brokerData = getText('div.sc-36f82cc0-0.kvuYMA'); 
        return brokerData !== 'Data not found' ? `Emiten: ${emiten} | Broker Data: ${brokerData}` : 'Broker Data: Data not found'; 
    }

    function extractTradeBookData() { 
        const getText = (selector) => { let element = document.querySelector(selector); if (!element) return 'Data not found'; let text = element.innerText.trim().replace(/\s+/g, ' ').replace(/\n+/g, ' '); return text; }; 
        let emiten = getText('h3.sc-f4f9b0e3-8');
        let tradeBookData = getText('div.sc-6041f6c9-1.dETQlc'); 
        return tradeBookData !== 'Data not found' ? `Emiten: ${emiten} | Trade Book Data: ${tradeBookData}` : 'Trade Book Data: Data not found'; 
    }

    // Function to send text to Google Gemini API for analysis
    function analyzeData(text, prompt, analysisType) {
        let url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;

        // Combine prompt and text
        let fullPrompt = prompt + '\n' + text;

        GM_xmlhttpRequest({
            method: 'POST',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            }),
            onload: function(response) {
                let result = JSON.parse(response.responseText);
                if (result && result.candidates && result.candidates[0] && result.candidates[0].content) {
                    let summary = result.candidates[0].content.parts[0].text;
                    showPopup(summary, text, analysisType); 
                } else {
                    showPopup('Error: Unable to analyze data. No valid response from API.', '', analysisType);
                }
            },
            onerror: function() {
                showPopup('Error: Failed to fetch data analysis', '', analysisType);
            }
        });
    }

    // Function to display modal pop-up with copy and confirm buttons
    function showPopup(summary, extractedText, analysisType) {
        let modal = document.createElement('div');
        modal.id = 'analysisModal';
        modal.innerHTML = `
            <div class="modal-container">
                <h3>${analysisType} Analysis</h3>
                <p><strong>Scraped Data & ${analysisType} Analysis:</strong></p>
                <div id="dataText" class="modal-text">${summary || extractedText}</div>
                <br>
                <button id="copyData" class="modal-button">Copy Data</button>
                <button id="startAnalysis" class="modal-button">Start Analysis</button>
                <button id="closeModal" class="modal-button">Close</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Close modal if clicked outside
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.remove();
            }
        });

        // Copy button functionality
        document.getElementById('copyData').addEventListener('click', () => {
            if (extractedText !== 'Running Trade Data: Data not found' && extractedText !== 'Broker Data: Data not found' && extractedText !== 'Trade Book Data: Data not found') {
                let fullText = (analysisType === 'Sentiment' ? sentimentPrompt : (analysisType === 'Running Trade' ? runningTradePrompt : (analysisType === 'Broker Summary' ? brokerSummaryPrompt : tradeBookPrompt))) + extractedText;
                navigator.clipboard.writeText(fullText).then(() => {
                    alert('Prompt and data copied to clipboard!');
                }).catch((err) => {
                    console.error('Failed to copy: ', err);
                });
            } else {
                alert('No data available to copy.');
            }
        });

        // Start Analysis button functionality
        document.getElementById('startAnalysis').addEventListener('click', () => {
            let prompt = analysisType === 'Sentiment' ? sentimentPrompt : (analysisType === 'Running Trade' ? runningTradePrompt : (analysisType === 'Broker Summary' ? brokerSummaryPrompt : tradeBookPrompt));
            analyzeData(extractedText, prompt, analysisType);  
            modal.remove();  
        });

        // Close button functionality
        document.getElementById('closeModal').addEventListener('click', () => modal.remove());
    }

    // Create a container for the buttons
    let buttonContainer = document.createElement('div');
    buttonContainer.id = 'buttonContainer'; // Set an ID for targeting in CSS
    buttonContainer.style = 'position:fixed;bottom:10px;width:100%;display:flex;flex-wrap:wrap;justify-content:center;gap:15px;z-index:10000;background:rgba(137, 137, 137, 0.19);padding:10px;font-family:"Proxima Nova","Open Sans",sans-serif;max-width:100%;';

    // Add buttons to trigger the display of data analysis
    let sentimentButton = document.createElement('button');
    sentimentButton.innerText = 'Analyze Sentiment';
    sentimentButton.style = 'padding:8px 12px;background:rgb(0, 171, 107);color:white;border:none;border-radius:2px;cursor:pointer;transition:background 0.3s ease;font-family:"Proxima Nova","Open Sans",sans-serif;font-size:14px;font-weight:bold;white-space:nowrap;';
    sentimentButton.onclick = function() {
        let text = extractData();
        if (text.length > 0) {
            showPopup('Click "Start Analysis" to start analyzing sentiment.', text, 'Sentiment');
        } else {
            showPopup('No relevant data found on the page.', '', 'Sentiment');
        }
    };
    buttonContainer.appendChild(sentimentButton);

    let runningTradeButton = document.createElement('button');
    runningTradeButton.innerText = 'Analyze Running Trade';
    runningTradeButton.style = 'padding:8px 12px;background:rgb(0, 171, 107);color:white;border:none;border-radius:2px;cursor:pointer;transition:background 0.3s ease;font-family:"Proxima Nova","Open Sans",sans-serif;font-size:14px;font-weight:bold;white-space:nowrap;';
    runningTradeButton.onclick = function() {
        let text = extractRunningTradeData();
        if (text !== 'Running Trade Data: Data not found') {
            showPopup('Click "Start Analysis" to start analyzing running trade.', text, 'Running Trade');
        } else {
            showPopup('No running trade data found on the page.', '', 'Running Trade');
        }
    };
    buttonContainer.appendChild(runningTradeButton);

    // Add broker summary button
    let brokerSummaryButton = document.createElement('button');
    brokerSummaryButton.innerText = 'Analyze BrokSum';
    brokerSummaryButton.style = 'padding:8px 12px;background:rgb(0, 171, 107);color:white;border:none;border-radius:2px;cursor:pointer;transition:background 0.3s ease;font-family:"Proxima Nova","Open Sans",sans-serif;font-size:14px;font-weight:bold;white-space:nowrap;';
    brokerSummaryButton.onclick = function() {
        let text = extractBrokerData();
        if (text !== 'Broker Data: Data not found') {
            showPopup('Click "Start Analysis" to start analyzing broker summary.', text, 'Broker Summary');
        } else {
            showPopup('No broker summary data found on the page.', '', 'Broker Summary');
        }
    };
    buttonContainer.appendChild(brokerSummaryButton);

    // Add trade book button
    let tradeBookButton = document.createElement('button');
    tradeBookButton.innerText = 'Analyze Trade Book';
    tradeBookButton.style = 'padding:8px 12px;background:rgb(0, 171, 107);color:white;border:none;border-radius:2px;cursor:pointer;transition:background 0.3s ease;font-family:"Proxima Nova","Open Sans",sans-serif;font-size:14px;font-weight:bold;white-space:nowrap;';
    tradeBookButton.onclick = function() {
        let text = extractTradeBookData();
        if (text !== 'Trade Book Data: Data not found') {
            showPopup('Click "Start Analysis" to start analyzing trade book.', text, 'Trade Book');
        } else {
            showPopup('No trade book data found on the page.', '', 'Trade Book');
        }
    };
    buttonContainer.appendChild(tradeBookButton);

    // Add the container to the page
    document.body.appendChild(buttonContainer);

    // Add styles for modal and buttons
    GM_addStyle(`
        .modal-container { 
            position: fixed; 
            top: 20%; 
            left: 50%; 
            transform: translate(-50%, 0); 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.2); 
            z-index: 10000; 
            width: 90%;
            max-width: 600px;
            font-family: "Proxima Nova", "Open Sans", sans-serif;
        }
        .modal-button { 
            margin-top: 20px; 
            padding: 8px 12px; 
            cursor: pointer; 
            margin-right: 10px;
            background-color: rgb(0, 171, 107); 
            color: white; 
            border: none; 
            border-radius: 2px;
            transition: background-color 0.3s ease;
            font-family: "Proxima Nova", "Open Sans", sans-serif;
            font-size: 14px;
            font-weight: bold;
        }
        .modal-button:hover {
            background-color: rgb(0, 150, 94);
        }
        .modal-text { 
            white-space: pre-wrap; 
            word-wrap: break-word; 
            font-family: "Proxima Nova", "Open Sans", sans-serif;
            font-size: 14px;
            color: #333;
        }
        #analysisModal {
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }

        /* Media query for small screens */
        @media (max-width: 768px) {
            #buttonContainer {
                max-width: 100% !important;  /* Set to 100% on small screens */
                left: 0 !important;
                transform: translateX(0) !important;
                padding: 10px 5px;
            }

            .modal-container {
                width: 95%; /* Adjust modal width for smaller screens */
            }
        }
    `);
})();
