// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    where,     
    doc,       
    updateDoc, 
    deleteDoc   // <--- NEW: Added this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTAl2cd38K1YIjQXoF4WtFYyuHULKlADk",
  authDomain: "cometho-cb1ce.firebaseapp.com",
  projectId: "cometho-cb1ce",
  storageBucket: "cometho-cb1ce.firebasestorage.app",
  messagingSenderId: "1024990432068",
  appId: "1:1024990432068:web:2955f5aec18c0908d22511"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresCollection = collection(db, "leaderboard");

// ==========================================
// GAME VARIABLES
// ==========================================

// Board setup
let board;
let boardWidth = 400; // Fixed width for gameplay consistency
let boardHeight = window.innerHeight; // Full vertical span
let context;

// User info
let username = "Anonymous";
let isGameStarted = false;

// Doodler
let doodlerWidth = 46;
let doodlerHeight = 46;
let doodlerX = boardWidth / 2 - doodlerWidth / 2;
let doodlerY = boardHeight * 7 / 8 - doodlerHeight;
let doodlerRightImg;
let doodlerLeftImg;

let doodler = {
    img: null,
    x: doodlerX,
    y: doodlerY,
    width: doodlerWidth,
    height: doodlerHeight
};

// Physics
let velocityX = 0;
let velocityY = 0;
let initialVelocityY = -8;
let gravity = 0.4;

// Platforms
let platformArray = [];
let platformWidth = 60;
let platformHeight = 18;
let platformImg;
let platformBrokenImg;


// Score
let score = 0;
let maxScore = 0;
let gameOver = false;

// DOM Elements
const scoreDisplay = document.getElementById("score-display");
const leaderboardList = document.getElementById("leaderboard-list");
const modal = document.getElementById("user-modal");
const usernameInput = document.getElementById("username-input");
const startBtn = document.getElementById("start-btn");

// ==========================================
// INITIALIZATION
// ==========================================

window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d");

    // Load Images
    doodlerRightImg = new Image();
    doodlerRightImg.src = "./doodler-right.png";
    doodler.img = doodlerRightImg;

    doodlerLeftImg = new Image();
    doodlerLeftImg.src = "./doodler-left.png";

    platformImg = new Image();
    platformImg.src = "./platform.png"; // Normal image

    platformBrokenImg = new Image();
    platformBrokenImg.src = "./platform-broken.png"; // New image for touched platforms

    // Handle Username Input
    startBtn.addEventListener("click", () => {
        const val = usernameInput.value.trim();
        if (val) {
            username = val;
            modal.style.display = "none";
            startGame();
        } else {
            alert("Please enter a Call Sign, Pilot!");
        }
    });

    // Load initial leaderboard
    fetchLeaderboard();
};

function startGame() {
    velocityY = initialVelocityY;
    placePlatforms();
    requestAnimationFrame(update);
    document.addEventListener("keydown", moveDoodler);
    isGameStarted = true;
}

// ==========================================
// GAME LOOP
// ==========================================

function update() {
    requestAnimationFrame(update);
    if (gameOver || !isGameStarted) {
        return;
    }

    context.clearRect(0, 0, board.width, board.height);

    // Doodler Physics
    doodler.x += velocityX;
    if (doodler.x > boardWidth) {
        doodler.x = 0;
    } else if (doodler.x + doodler.width < 0) {
        doodler.x = boardWidth;
    }

    velocityY += gravity;
    doodler.y += velocityY;

    // Game Over Condition
    if (doodler.y > board.height) {
        handleGameOver();
    }

    context.drawImage(doodler.img, doodler.x, doodler.y, doodler.width, doodler.height);

    // Platform Physics
    // Platform Physics
    for (let i = 0; i < platformArray.length; i++) {
        let platform = platformArray[i];

        // Move platforms down as we jump up
        if (velocityY < 0 && doodler.y < boardHeight * 3 / 4) {
            platform.y -= initialVelocityY; 
        }

        // Collision Detection
        if (detectCollision(doodler, platform) && velocityY >= 0) {
            velocityY = initialVelocityY; // ALWAYS JUMP

            if (!platform.isBroken) {
                // First bounce: Break the platform
                platform.isBroken = true;
                platform.img = platformBrokenImg;
            } else {
                // Second bounce: Remove the platform
                platformArray.splice(i, 1);
                i--; 
            }
        }
        
        // Only draw if it still exists
        if (platform) { 
            context.drawImage(platform.img, platform.x, platform.y, platform.width, platform.height);
        }
    }

    // Clear platforms and add new ones
    while (platformArray.length > 0 && platformArray[0].y >= boardHeight) {
        platformArray.shift();
        newPlatform();
    }

    // Score Update
    updateScore();
    
    // Update Sidebar Score
    scoreDisplay.innerText = score; 

    // Draw 'GameOver' text on canvas as backup
    if (gameOver) {
        context.fillStyle = "white";
        context.font = "20px Orbitron";
        context.fillText("Connection Lost", boardWidth/4, boardHeight/2);
        context.fillText("Press Space to Reboot", boardWidth/5, boardHeight/2 + 40);
    }
}

function moveDoodler(e) {
    if (e.code == "ArrowRight" || e.code == "KeyD") {
        velocityX = 4;
        doodler.img = doodlerRightImg;
    } else if (e.code == "ArrowLeft" || e.code == "KeyA") {
        velocityX = -4;
        doodler.img = doodlerLeftImg;
    } else if (e.code == "Space" && gameOver) {
        resetGame();
    }
}

function placePlatforms() {
    platformArray = [];

    // Starting platform (Invulnerable for the very first jump to be fair)
    let startPlatform = {
        img: platformImg,
        x: boardWidth / 2,
        y: boardHeight - 50,
        width: platformWidth,
        height: platformHeight,
        isBroken: false 
    };
    platformArray.push(startPlatform);

    // Fill screen with platforms
    for (let i = 0; i < 10; i++) { // Increased count for taller screen
        let randomX = Math.floor(Math.random() * (boardWidth * 3 / 4));
        let platform = {
            img: platformImg,
            x: randomX,
            y: boardHeight - 75 * i - 150,
            width: platformWidth,
            height: platformHeight,
            isBroken: false
        };
        platformArray.push(platform);
    }
}

function newPlatform() {
    let randomX = Math.floor(Math.random() * (boardWidth * 3 / 4));
    let platform = {
        img: platformImg,
        x: randomX,
        y: -platformHeight,
        width: platformWidth,
        height: platformHeight,
        isBroken: false
    };
    platformArray.push(platform);
}

function detectCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function updateScore() {
    let points = Math.floor(50 * Math.random());
    if (velocityY < 0) {
        maxScore += points;
        if (score < maxScore) {
            score = maxScore;
        }
    } else if (velocityY >= 0) {
        maxScore -= points;
    }
}

// ==========================================
// GAME OVER & FIREBASE LOGIC
// ==========================================

async function handleGameOver() {
    gameOver = true;
    
    // Search for ALL entries with this username
    const q = query(scoresCollection, where("name", "==", username));
    
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // CASE A: User is new. Create first record.
            await addDoc(scoresCollection, {
                name: username,
                score: score,
                timestamp: new Date()
            });
            console.log("New pilot registered.");
        } else {
            // CASE B: User exists (and might have duplicates).
            // 1. Get all documents found
            const docs = querySnapshot.docs;
            
            // 2. Find the document with the highest previous score to keep
            let bestDoc = docs[0];
            let bestStoredScore = bestDoc.data().score;

            docs.forEach(d => {
                if (d.data().score > bestStoredScore) {
                    bestStoredScore = d.data().score;
                    bestDoc = d;
                }
            });

            // 3. Delete all OTHER duplicate documents
            for (const d of docs) {
                if (d.id !== bestDoc.id) {
                    await deleteDoc(doc(db, "leaderboard", d.id));
                    console.log("Duplicate deleted:", d.id);
                }
            }

            // 4. Update the ONE remaining document if current game is higher
            if (score > bestStoredScore) {
                await updateDoc(doc(db, "leaderboard", bestDoc.id), {
                    score: score,
                    timestamp: new Date()
                });
                console.log("New High Score updated!");
            } else {
                console.log("Score not high enough. Database cleaned.");
            }
        }
        
        fetchLeaderboard(); // Refresh the list
    } catch (e) {
        console.error("Error updating score: ", e);
    }
}

function resetGame() {
    doodler = {
        img: doodlerRightImg,
        x: doodlerX,
        y: doodlerY,
        width: doodlerWidth,
        height: doodlerHeight
    };
    velocityX = 0;
    velocityY = initialVelocityY;
    score = 0;
    maxScore = 0;
    gameOver = false;
    placePlatforms();
}

async function fetchLeaderboard() {
    const q = query(scoresCollection, orderBy("score", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    
    leaderboardList.innerHTML = ""; // Clear list
    
    let rank = 1;
    querySnapshot.forEach((doc) => {
        let data = doc.data();
        let li = document.createElement("li");
        li.innerHTML = `
            <div>
                <span class="rank">#${rank}</span>
                <span class="name">${data.name}</span>
            </div>
            <span class="score">${data.score}</span>
        `;
        leaderboardList.appendChild(li);
        rank++;
    });
}