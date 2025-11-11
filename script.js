// Global variables
let db = null;
let SQL = null;

// Constants for RYOE calculation
const SLOPE = 0.12588674;
const INTERCEPT = 3.47336519;

// Initialize the application
async function init() {
    try {
        showLoading(true);
        
        // Initialize SQL.js
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Load and parse CSV data
        await loadCSVData();
        
        // Setup event listeners
        setupEventListeners();
        
        showLoading(false);
        document.getElementById('app-content').classList.remove('hidden');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application: ' + error.message);
    }
}

// Load CSV data and create SQLite database
async function loadCSVData() {
    try {
        const response = await fetch('data/plays.csv');
        if (!response.ok) {
            throw new Error('Failed to load plays.csv');
        }
        
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
            throw new Error('No data found in CSV file');
        }
        
        // Create new database
        db = new SQL.Database();
        
        // Create table with appropriate schema
        db.run(`
            CREATE TABLE plays (
                play_id INTEGER,
                rush_attempt INTEGER,
                rusher_player_name TEXT,
                yards_gained INTEGER,
                ydstogo INTEGER
            )
        `);
        
        // Prepare insert statement
        const stmt = db.prepare(`
            INSERT INTO plays (play_id, rush_attempt, rusher_player_name, yards_gained, ydstogo)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        // Insert data rows (skip header)
        const headers = rows[0];
        const playIdIdx = headers.indexOf('play_id');
        const rushAttemptIdx = headers.indexOf('rush_attempt');
        const rusherNameIdx = headers.indexOf('rusher_player_name');
        const yardsGainedIdx = headers.indexOf('yards_gained');
        const ydstogoIdx = headers.indexOf('ydstogo');
        
        if (rushAttemptIdx === -1 || rusherNameIdx === -1 || yardsGainedIdx === -1 || ydstogoIdx === -1) {
            throw new Error('Required columns not found in CSV');
        }
        
        // Insert rows in batches for better performance
        let insertCount = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < Math.max(playIdIdx, rushAttemptIdx, rusherNameIdx, yardsGainedIdx, ydstogoIdx) + 1) {
                continue; // Skip malformed rows
            }
            
            const playId = row[playIdIdx] || null;
            const rushAttempt = row[rushAttemptIdx] ? parseInt(row[rushAttemptIdx]) : 0;
            const rusherName = row[rusherNameIdx] || null;
            const yardsGained = row[yardsGainedIdx] ? parseInt(row[yardsGainedIdx]) : 0;
            const ydstogo = row[ydstogoIdx] ? parseInt(row[ydstogoIdx]) : 0;
            
            // Only insert rush attempts with valid data
            if (rushAttempt === 1 && rusherName) {
                stmt.run([playId, rushAttempt, rusherName, yardsGained, ydstogo]);
                insertCount++;
            }
        }
        
        stmt.free();
        
        console.log(`Loaded ${insertCount} rush attempts into database`);
        
    } catch (error) {
        console.error('Error loading CSV:', error);
        throw error;
    }
}

// Simple CSV parser
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip \n in \r\n
            }
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            }
        } else {
            currentField += char;
        }
    }
    
    // Add last row if exists
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    
    return rows;
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('playerForm').addEventListener('submit', handlePlayerLookup);
    document.getElementById('leaderboardForm').addEventListener('submit', handleLeaderboard);
}

// Handle player lookup
async function handlePlayerLookup(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerNameInput').value.trim();
    const resultsDiv = document.getElementById('playerResults');
    
    if (!playerName) {
        showMessage(resultsDiv, 'Please enter a player name', 'error');
        return;
    }
    
    try {
        const query = `
            SELECT COUNT(*) as rushes,
                AVG(yards_gained - (ydstogo * ${SLOPE} + ${INTERCEPT})) as ryoe
            FROM plays
            WHERE rush_attempt = 1 AND rusher_player_name = ?
        `;
        
        const stmt = db.prepare(query);
        stmt.bind([playerName]);
        
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            
            if (row.rushes === 0) {
                showMessage(resultsDiv, `No rushing data found for "${playerName}". Please check the spelling and try again.`, 'error');
            } else {
                displayPlayerStats(resultsDiv, playerName, row);
            }
        } else {
            stmt.free();
            showMessage(resultsDiv, `No data found for "${playerName}"`, 'error');
        }
        
    } catch (error) {
        console.error('Query error:', error);
        showMessage(resultsDiv, 'Error executing query: ' + error.message, 'error');
    }
}

// Handle leaderboard
async function handleLeaderboard(e) {
    e.preventDefault();
    
    const minRushes = parseInt(document.getElementById('minRushesInput').value);
    const resultsDiv = document.getElementById('leaderboardResults');
    
    if (!minRushes || minRushes < 1) {
        showMessage(resultsDiv, 'Please enter a valid minimum number of rushes', 'error');
        return;
    }
    
    try {
        const query = `
            SELECT rusher_player_name, COUNT(*) as rushes,
                AVG(yards_gained - (ydstogo * ${SLOPE} + ${INTERCEPT})) as ryoe
            FROM plays
            WHERE rush_attempt = 1
            GROUP BY rusher_player_name
            HAVING rushes >= ?
            ORDER BY ryoe DESC
            LIMIT 10
        `;
        
        const stmt = db.prepare(query);
        stmt.bind([minRushes]);
        
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        
        if (results.length === 0) {
            showMessage(resultsDiv, `No players found with at least ${minRushes} rushes.`, 'error');
        } else {
            displayLeaderboard(resultsDiv, results, minRushes);
        }
        
    } catch (error) {
        console.error('Query error:', error);
        showMessage(resultsDiv, 'Error executing query: ' + error.message, 'error');
    }
}

// Display player statistics
function displayPlayerStats(container, playerName, stats) {
    const ryoe = stats.ryoe !== null ? stats.ryoe.toFixed(2) : '0.00';
    const ryoeClass = parseFloat(ryoe) >= 0 ? 'positive' : 'negative';
    
    container.innerHTML = `
        <div class="player-stats">
            <h3>📊 ${playerName}</h3>
            <div class="stat-grid">
                <div class="stat-card">
                    <div class="label">Total Rushes</div>
                    <div class="value">${stats.rushes}</div>
                </div>
                <div class="stat-card">
                    <div class="label">RYOE</div>
                    <div class="value ${ryoeClass}">${ryoe}</div>
                </div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

// Display leaderboard
function displayLeaderboard(container, results, minRushes) {
    let tableHTML = `
        <div class="success-message">
            Found ${results.length} player${results.length !== 1 ? 's' : ''} with at least ${minRushes} rushes.
        </div>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Player Name</th>
                    <th>Rushes</th>
                    <th>RYOE</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    results.forEach((row, index) => {
        const ryoe = row.ryoe !== null ? row.ryoe.toFixed(2) : '0.00';
        const ryoeClass = parseFloat(ryoe) >= 0 ? 'positive' : 'negative';
        
        tableHTML += `
            <tr>
                <td class="rank">#${index + 1}</td>
                <td>${row.rusher_player_name}</td>
                <td>${row.rushes}</td>
                <td class="${ryoeClass}">${ryoe}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    container.classList.remove('hidden');
}

// Show message in container
function showMessage(container, message, type) {
    const className = type === 'error' ? 'error-message' : 'success-message';
    container.innerHTML = `<div class="${className}">${message}</div>`;
    container.classList.remove('hidden');
}

// Show/hide loading indicator
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (show) {
        loadingDiv.classList.remove('hidden');
    } else {
        loadingDiv.classList.add('hidden');
    }
}

// Show error in loading area
function showError(message) {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.innerHTML = `
        <div class="error-message">
            <strong>Error:</strong> ${message}
        </div>
    `;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
