// ======================================================
// 1. IMPORT & CẤU HÌNH
// ======================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, update, onValue, get, set, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import { meansData, cluesData, forensicData, ROLES } from "./data.js";
import { createNguoiChoiAPI } from "./nguoichoi.js";
import { createDieuTraVienAPI } from "./dieutravien.js";
import { createHungThuAPI } from "./hungthu.js";
import { initVoiceChat, leaveVoiceChat } from "./voiceChat.js";

// API Key (Giữ nguyên của bạn)
const firebaseConfig = {
  apiKey: "AIzaSyCKvlyh5VEpOKTf1u8Rtt6nuhrSiYg-N20",
  authDomain: "deception-murder-in-hongkong.firebaseapp.com",
  databaseURL: "https://deception-murder-in-hongkong-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "deception-murder-in-hongkong",
  storageBucket: "deception-murder-in-hongkong.firebasestorage.app",
  messagingSenderId: "340861898380",
  appId: "1:340861898380:web:0a9b4e955895127ae775a9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ROOM_ID = 'phong-vip-01'; 
const roomRef = ref(db, 'rooms/' + ROOM_ID);

// ======================================================
// 2. STATE & BIẾN CỤC BỘ
// ======================================================
let myId = localStorage.getItem('deception_uid') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('deception_uid', myId);

let localState = null;
let selectedCards = { mean: null, clue: null };

// ======================================================
// 3. CORE LOGIC
// ======================================================
onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        localState = { status: 'LOBBY', players: {} };
        renderUI();
        return;
    }
    localState = data;
    renderUI();
});

// Lắng nghe Chat
onValue(ref(db, `rooms/${ROOM_ID}/chat`), (snapshot) => {
    const chatData = snapshot.val();
    const chatBox = document.getElementById('chat-messages');
    if (!chatBox) return;

    const isNearBottom = () => (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 100;
    const shouldStickBottom = isNearBottom();

    if (!chatData) {
        chatBox.innerHTML = '<div class="text-center text-gray-500 text-xs italic mt-4">Kênh liên lạc bảo mật đã mở.</div>';
        return;
    }

    const messages = Object.values(chatData).sort((a, b) => a.timestamp - b.timestamp);
    
    chatBox.innerHTML = messages.map(msg => {
        const isMe = (msg.senderId === myId);
        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2">
                <div class="text-[10px] text-gray-400 mb-0.5 ${isMe ? 'mr-1' : 'ml-1'} font-bold uppercase">${msg.senderName}</div>
                <div class="${isMe ? 'bg-brand-blue/80 text-white' : 'bg-white/10 text-gray-200'} px-3 py-1.5 rounded-lg max-w-[90%] text-sm break-words backdrop-blur-sm border border-white/5">
                    ${msg.text}
                </div>
            </div>
        `;
    }).join('');
    
    if (shouldStickBottom) chatBox.scrollTop = chatBox.scrollHeight;
});

// ======================================================
// 4. HÀM RENDER UI
// ======================================================
function renderUI() {
    const status = localState?.status || 'LOBBY';
    const players = localState?.players || {};
    const phase = localState?.phase || '';
    
    const me = players[myId];
    const pList = Object.values(players);

    // --- MÀN HÌNH LOBBY ---
    if (status === 'LOBBY') {
        showScreen('lobby-screen');
        if (!me) { showScreen('login-screen'); return; }

        document.getElementById('current-player-name').innerText = me.name;
        document.getElementById('player-count-badge').innerText = `ĐANG KẾT NỐI: ${pList.length} / 18`;
        
        const listEl = document.getElementById('player-list');
        listEl.innerHTML = pList.map(p => 
            `<li class="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center hover:bg-white/10 transition">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br ${p.isHost ? 'from-red-500 to-orange-500' : 'from-gray-700 to-gray-600'} flex items-center justify-center text-xs font-bold shadow-lg">
                        ${p.name.charAt(0).toUpperCase()}
                    </div>
                    <span class="font-bold ${p.id === myId ? 'text-brand-gold' : 'text-gray-300'} font-sans">${p.name}</span>
                </div>
                ${p.isHost ? '<span class="text-[9px] bg-brand-red px-2 py-0.5 rounded text-white font-bold uppercase tracking-wider shadow-sm">HOST</span>' : ''}
            </li>`
        ).join('');
        
        const hostPanel = document.getElementById('host-controls');
        const chatPanel = document.getElementById('lobby-chat-panel');
        
        if (chatPanel) chatPanel.classList.remove('hidden');

        if (me.isHost) {
            hostPanel.classList.remove('hidden');
            const startBtn = document.getElementById('start-btn');
            const hostMsg = document.getElementById('host-msg');
            const MIN_PLAYERS = 6; 
            
            // Luôn hiện nút cho host, chỉ disable khi chưa đủ điều kiện
            startBtn.classList.remove('hidden');
            if (pList.length >= MIN_PLAYERS && pList.length <= 18) {
                startBtn.disabled = false;
                hostMsg.classList.add('hidden');
            } else {
                startBtn.disabled = true;
                hostMsg.classList.remove('hidden');
                hostMsg.innerText = (pList.length < MIN_PLAYERS) ? `Cần thêm ${MIN_PLAYERS - pList.length} điều tra viên!` : `Quá đông!`;
            }
        } else {
            hostPanel.classList.add('hidden'); 
        }
        return;
    }

    // --- MÀN HÌNH GAME ---
    if (status === 'PLAYING' || status === 'END_GAME') {
        if (!me) { showScreen('login-screen'); return; }
        showScreen('game-screen');
        renderRoleInfo(me);
        renderForensicBoard(localState.forensic, me.role.id === 'FORENSIC');
        renderGameBoard(pList, me);
        
        // Tự động kết nối voice chat khi game bắt đầu
        const voiceConfig = localState.config?.voiceEnabled;
        if (voiceConfig && !window.hasJoinedVoice) {
            // Set flag để tránh gọi nhiều lần
            window.hasJoinedVoice = true;
            
            // Tự động kết nối voice chat (mic tắt mặc định)
            console.log("🎮 Game bắt đầu - Đang kết nối Voice Chat...");
            initVoiceChat(ROOM_ID, myId).then(() => {
                console.log("✅ Voice Chat đã sẵn sàng! Bấm nút Mic để nói.");
            }).catch(err => {
                console.error("❌ Lỗi kết nối Voice Chat:", err);
                window.hasJoinedVoice = false; // Reset flag nếu lỗi
            });
        }
        
        handleGamePhase(phase, me);
    }
}

function renderRoleInfo(me) {
    const roleInfo = document.getElementById('my-role-info');
    const container = roleInfo ? roleInfo.parentElement : null;
    
    // Đổi màu viền thẻ vai trò dựa trên team
    let borderColor = 'border-l-gray-500';
    let titleColor = 'text-gray-400';
    if (me.role.team === 'RED') { borderColor = 'border-l-brand-red'; titleColor = 'text-brand-red'; }
    if (me.role.team === 'BLUE') { borderColor = 'border-l-brand-blue'; titleColor = 'text-brand-blue'; }
    if (me.role.team === 'GRAY') { borderColor = 'border-l-gray-400'; }

    if (container) {
        container.className = `bg-gray-800 border border-gray-700 rounded-lg p-4 flex-1 text-center relative overflow-hidden group min-h-[100px] flex items-center justify-center border-l-4 ${borderColor}`;
    }

    roleInfo.innerHTML = `
        <div class="p-4 animate-fadeIn text-center">
            <h3 class="text-3xl font-display font-extrabold ${titleColor} uppercase drop-shadow-md tracking-wider mb-2">${me.role.name}</h3>
            <p class="text-sm text-gray-300 font-light border-t border-white/10 pt-2 inline-block px-6">${me.role.desc}</p>
        </div>
    `;
}

function renderForensicBoard(forensic, isForensic) {
    const board = document.getElementById('forensic-board');
    const container = document.getElementById('forensic-tiles');
    
    if (!forensic) { board.classList.add('hidden'); return; }
    board.classList.remove('hidden');
    container.innerHTML = '';

    const createTile = (type, data, index = 0) => {
        let itemsHTML = data.items.map((text, idx) => {
            const isSelected = (data.selected === idx);
            const cursorClass = isForensic ? 'cursor-pointer hover:bg-white/10' : ''; 
            const bgClass = isSelected 
                ? 'bg-gradient-to-r from-brand-gold to-yellow-600 text-black font-bold shadow-lg scale-105 border-transparent' 
                : 'text-gray-400 border-b border-white/5';
            const clickEvent = isForensic ? `onclick="forensicSelect('${type}', ${index}, ${idx})"` : '';
            
            return `<li ${clickEvent} class="py-1.5 px-2 rounded ${bgClass} ${cursorClass} text-[11px] transition-all duration-200 flex items-center justify-between group/item">
                <span>${text}</span>
                ${isSelected ? '<span class="text-[10px]">●</span>' : ''}
            </li>`;
        }).join('');

        const headerColor = (type === 'purple') ? 'text-brand-purple' : (type === 'green') ? 'text-green-400' : 'text-brand-gold';
        const icon = (type === 'purple') ? '💀' : (type === 'green') ? '📍' : '🔍';
        
        const changeBtn = (isForensic && (type === 'green' || type === 'yellow'))
            ? `<button onclick="event.stopPropagation(); forensicChangeTile('${type}', ${index})" 
                 class="absolute -top-2 -right-2 bg-gray-700 hover:bg-brand-gold hover:text-black text-white text-[10px] w-6 h-6 rounded-full shadow border border-gray-500 flex items-center justify-center transition z-10">
                 ↻
               </button>` 
            : '';

        return `<div class="bg-black/30 border border-white/10 rounded-lg p-3 relative group hover:border-white/20 transition">
                ${changeBtn}
                <h4 class="font-bold ${headerColor} text-[10px] uppercase mb-2 tracking-widest flex items-center gap-1.5">
                    <span class="text-base">${icon}</span> ${data.vi}
                </h4>
                <ul class="space-y-1">${itemsHTML}</ul>
            </div>`;
    };

    if(forensic.purple) container.innerHTML += createTile('purple', forensic.purple);
    if(forensic.green) container.innerHTML += createTile('green', forensic.green);
    if(forensic.yellow) forensic.yellow.forEach((tile, idx) => { 
        container.innerHTML += createTile('yellow', tile, idx); 
    });
}

function renderGameBoard(pList, me) {
    const container = document.getElementById('game-board');
    
    // Role Checks
    const iAmAccomplice = (me.role.id === 'ACCOMPLICE');
    const iAmWitness = (me.role.id === 'WITNESS');
    const iAmForensic = (me.role.id === 'FORENSIC'); 
    const iAmMurderer = (me.role.id === 'MURDERER');

    container.innerHTML = pList.map(p => {
        if (p.role.id === 'FORENSIC') return ''; 

        const isTargetMurderer = (p.role.id === 'MURDERER');
        const murdererAllies = ['ACCOMPLICE', 'SMART_ACCOMPLICE', 'SCAPEGOAT'];
        const isMyTeammate = murdererAllies.includes(p.role.id);
        
        let specialBadge = '';
        // Mặc định border xám mờ
        let boxBorderClass = (p.id === myId) ? 'border-brand-gold/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-white/10';
        let bgClass = (p.id === myId) ? 'bg-brand-gold/5' : 'bg-black/20';

        // --- HIGHLIGHT ROLES ---
        if (iAmAccomplice && isTargetMurderer) {
            boxBorderClass = 'border-red-600 shadow-neon-red';
            specialBadge = `<div class="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-lg">SÁT NHÂN</div>`;
        }
        if (iAmMurderer && isMyTeammate) {
            boxBorderClass = 'border-red-900/50';
            specialBadge = `<div class="absolute top-0 right-0 bg-red-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">ĐỒNG PHẠM (${p.role.name})</div>`;
        }
        if (iAmWitness && (p.role.team === 'RED')) {
            boxBorderClass = 'border-gray-500'; 
            specialBadge = `<div class="absolute top-0 right-0 bg-gray-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">KẺ TÌNH NGHI</div>`;
        }
        if (iAmForensic && p.id !== myId) {
            let roleColor = 'bg-gray-600';
            if (p.role.team === 'RED') roleColor = 'bg-brand-red';
            if (p.role.team === 'BLUE') roleColor = 'bg-brand-blue';
            specialBadge = `<div class="absolute top-0 right-0 ${roleColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider opacity-80">${p.role.name}</div>`;
        }

        // --- CARDS RENDER ---
        const renderCard = (c, type) => {
            const isMeans = (type === 'mean');
            const colorClass = isMeans ? 'text-brand-blue' : 'text-brand-red';
            
            const isSelectedByMe = (p.id === myId && selectedCards[type] === c.vi);
            const isTheCrime = (localState.crime && localState.crime[type] === c.vi);
            
            // Logic hiển thị đáp án
            const isRedTeam = ['MURDERER', 'ACCOMPLICE', 'SMART_ACCOMPLICE', 'SCAPEGOAT'].includes(me.role.id);
            const showAnswer = (isTheCrime && (isRedTeam || iAmForensic));

            let cardBg = isMeans ? 'bg-brand-blue/5' : 'bg-brand-red/5';
            let cardBorder = isMeans ? 'border-brand-blue/30' : 'border-brand-red/30';
            let shadow = '';

            if (isSelectedByMe) {
                cardBorder = 'border-brand-gold';
                cardBg = 'bg-brand-gold/10';
                shadow = 'shadow-[0_0_10px_rgba(234,179,8,0.3)]';
            } else if (showAnswer) {
                cardBorder = 'border-red-500';
                cardBg = 'bg-red-900/40';
                shadow = 'shadow-neon-red animate-pulse';
            }

            const canClick = (p.id === myId && localState.phase === 'NIGHT_MURDERER' && iAmMurderer);

            return `
            <div ${canClick ? `onclick="cardClick('${type}', '${c.vi}')"` : ''} 
                 class="relative ${cardBg} border ${cardBorder} ${shadow} p-2 rounded mb-1.5 transition-colors duration-200 ${canClick ? 'cursor-pointer' : ''}">
                <div class="flex justify-between items-start">
                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-wider">${c.en}</span>
                    ${showAnswer ? '<span class="text-[8px] text-red-500 font-bold">★</span>' : ''}
                </div>
                <div class="text-sm font-bold text-gray-200 mt-0.5">${c.vi}</div>
            </div>`;
        };

        return `
            <div class="glass-panel rounded-xl p-0 overflow-hidden border ${boxBorderClass} ${bgClass} transition-all duration-300 hover:shadow-lg relative group">
                ${specialBadge}
                <div class="p-3 bg-black/20 border-b border-white/5 flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-lg shadow-inner">
                        🕵️
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-sm truncate text-white">${p.name} ${p.id === myId ? '<span class="text-brand-gold">(Bạn)</span>' : ''}</h3>
                        ${p.canSolve ? '<div class="text-[9px] text-brand-blue uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 bg-brand-blue rounded-full animate-pulse"></span> Còn huy hiệu</div>' : '<div class="text-[9px] text-gray-600 uppercase">Đã mất huy hiệu</div>'}
                    </div>
                </div>
                
                <div class="p-3 grid grid-cols-2 gap-3">
                    <div>
                        <h4 class="text-[10px] text-brand-blue font-bold uppercase tracking-widest mb-2 border-b border-brand-blue/20 pb-1">Hung Khí</h4>
                        ${p.hand.means.map(c => renderCard(c, 'mean')).join('')}
                    </div>
                    <div>
                        <h4 class="text-[10px] text-brand-red font-bold uppercase tracking-widest mb-2 border-b border-brand-red/20 pb-1">Vật Chứng</h4>
                        ${p.hand.clues.map(c => renderCard(c, 'clue')).join('')}
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ======================================================
// 5. ACTIONS & UTILS
// ======================================================

window.startGame = () => {
    // (Giữ nguyên logic cũ, chỉ đổi phase)
    const players = localState.players || {};
    const pList = Object.values(players);
    const accompliceCount = parseInt(document.getElementById('cfg-accomplice').value) || 1;
    const isChecked = (id) => document.getElementById(id)?.checked;
    const voiceCheckbox = document.getElementById('cfg-voice-chat');
    const isVoiceEnabled = voiceCheckbox ? voiceCheckbox.checked : false;

    if (pList.length < 6) return alert("Chưa đủ người!");
    // Logic chia vai (giữ nguyên code cũ của bạn)
    let rolePool = [ROLES.FORENSIC, ROLES.MURDERER, ROLES.WITNESS];
    for(let i=0; i < accompliceCount; i++) rolePool.push(ROLES.ACCOMPLICE);
    if (isChecked('cfg-witness-guard')) rolePool.push(ROLES.WITNESS_GUARD);
    if (isChecked('cfg-technician')) rolePool.push(ROLES.TECHNICIAN);
    if (isChecked('cfg-consultant')) rolePool.push(ROLES.CONSULTING_DETECTIVE);
    if (isChecked('cfg-psychologist')) rolePool.push(ROLES.PSYCHOLOGIST);
    if (isChecked('cfg-victim-family')) rolePool.push(ROLES.VICTIM_FAMILY);
    if (isChecked('cfg-inside-man')) rolePool.push(ROLES.INSIDE_MAN);
    if (isChecked('cfg-smart-accomplice')) rolePool.push(ROLES.SMART_ACCOMPLICE);
    if (isChecked('cfg-scapegoat')) rolePool.push(ROLES.SCAPEGOAT);

    while (rolePool.length < pList.length) rolePool.push(ROLES.INVESTIGATOR);
    rolePool = shuffle(rolePool);

    let meansDeck = shuffle([...meansData]);
    let cluesDeck = shuffle([...cluesData]);

    const updates = {};
    updates[`status`] = 'PLAYING';
    updates[`phase`] = 'NIGHT_MURDERER'; 
    
    updates[`config/voiceEnabled`] = isVoiceEnabled;
    // Setup Forensic board
    const forensicSetup = {
        purple: { ...forensicData.purple, selected: null },
        green: { ...shuffle(forensicData.green)[0], selected: null },
        yellow: shuffle(forensicData.yellow).slice(0, 4).map(t => ({ ...t, selected: null }))
    };
    updates[`forensic`] = forensicSetup;
    updates[`crime`] = { mean: null, clue: null };

    pList.forEach((p, i) => {
        const role = rolePool[i];
        const hand = (role.id === 'FORENSIC') ? null : {
            means: meansDeck.splice(0, 4),
            clues: cluesDeck.splice(0, 4)
        };
        updates[`players/${p.id}/role`] = role;
        updates[`players/${p.id}/hand`] = hand;
        updates[`players/${p.id}/canSolve`] = (role.id !== 'FORENSIC');
    });

    update(roomRef, updates);
};

// ... Các hàm Forensic logic giữ nguyên (forensicSelect, forensicChangeTile) ...
window.forensicSelect = (type, index, itemIndex) => {
    const me = localState.players[myId];
    if (me.role.id !== 'FORENSIC') return;
    const path = (type === 'purple') ? `forensic/purple/selected` 
               : (type === 'green') ? `forensic/green/selected`
               : `forensic/yellow/${index}/selected`;
    update(roomRef, { [path]: itemIndex }).then(() => {
        if (localState.phase === 'PENALTY_STEP') update(roomRef, { phase: 'DAY_DISCUSSION' });
    });
};

window.forensicChangeTile = (type, index) => {
    const me = localState.players[myId];
    if (me.role.id !== 'FORENSIC') return;
    let newData = null;
    if (type === 'green') {
        const current = localState.forensic.green;
        const available = forensicData.green.filter(t => t.items[0] !== current.items[0]);
        if (available.length > 0) {
            newData = shuffle(available)[0];
            update(roomRef, { [`forensic/green`]: { ...newData, selected: null } });
        }
    } else if (type === 'yellow') {
        const currentTiles = localState.forensic.yellow.map(t => t.en);
        const available = forensicData.yellow.filter(t => !currentTiles.includes(t.en));
        if (available.length > 0) {
            newData = shuffle(available)[0];
            update(roomRef, { [`forensic/yellow/${index}`]: { ...newData, selected: null } });
        }
    }
};

function handleGamePhase(phase, me) {
    const actionBar = document.getElementById('action-bar');
    const actionText = document.getElementById('action-text');
    const controls = document.getElementById('action-controls');
    
    actionBar.classList.remove('translate-y-full');
    
    if (localState?.status === 'END_GAME') {
        controls.innerHTML = `<button onclick="returnToLobby()" class="bg-gray-700 text-white px-5 py-2 rounded-lg font-bold hover:bg-gray-600 transition border border-white/20">↩️ Quay Về Phòng</button>`;
        actionText.innerText = localState.lastActionMsg || 'Ván chơi đã kết thúc.';
        return;
    }

    let msg = "";
    if (phase === 'NIGHT_MURDERER') {
        msg = (me.role.id === 'MURDERER') ? "😈 Chọn 1 HUNG KHÍ và 1 VẬT CHỨNG!" : "Đêm xuống... Hung thủ đang hành động.";
        if (me.role.id !== 'MURDERER') controls.innerHTML = '';
    } else if (phase === 'FORENSIC_STEP_1') {
        msg = (me.role.id === 'FORENSIC') ? "👮 Pháp Y: Hãy chọn các gợi ý!" : "Pháp Y đang phân tích hiện trường...";
        controls.innerHTML = '';
    } else if (phase === 'DAY_DISCUSSION') {
        msg = "Trời sáng! Hãy thảo luận và tìm ra hung thủ.";
        controls.innerHTML = '';
        const btnSolve = document.getElementById('btn-solve');
        if (me.canSolve && me.role.id !== 'FORENSIC') {
            btnSolve.disabled = false;
        } else {
            btnSolve.disabled = true;
        }
    } else if (phase === 'PENALTY_STEP') {
         msg = (me.role.id === 'FORENSIC') ? "⚠️ Phá án sai! Hãy ĐỔI 1 thẻ gợi ý bất kỳ!" : "Pháp Y đang thay đổi manh mối do tố cáo sai...";
         controls.innerHTML = '';
    } else if (phase === 'MURDERER_LAST_CHANCE') {
        if (me.role.team === 'RED') {
            msg = "😈 CƠ HỘI CUỐI: Tìm Nhân Chứng để lật kèo!";
            controls.innerHTML = `<button onclick="openKillWitnessModal()" class="bg-red-600 text-white px-6 py-2 rounded font-bold shadow-neon-red animate-pulse border border-red-400">🔫 GIẾT NHÂN CHỨNG</button>`;
        } else {
            msg = "😱 Sát Nhân đang tìm cách thủ tiêu Nhân Chứng!";
            controls.innerHTML = '';
        }
    }
    if (localState.lastActionMsg) msg = localState.lastActionMsg;
    actionText.innerHTML = msg; 
}

function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }
function showScreen(id) {
    ['login-screen', 'lobby-screen', 'game-screen'].forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// Helper: Tạo card có thể chọn (dùng cho modal Phá Án)
function createSelectableCard(card, type, ownerName = '', ownerId = '') {
    // Style update cho modal selection
    return `<div class="select-card-${type} bg-gray-800 border border-gray-600 p-2 rounded cursor-pointer transition hover:bg-gray-700 relative group"
             onclick="tempSelect(this, '${type}', '${card.vi}')">
            ${ownerName ? `<div class="text-[9px] text-gray-400 mb-1 uppercase font-bold tracking-wider">${ownerName}</div>` : ''}
            <div class="font-bold text-white text-sm">${card.vi}</div>
            <div class="absolute inset-0 border-2 border-transparent transition-all pointer-events-none rounded group-hover:border-white/20"></div>
        </div>`;
}

window.closeModal = () => document.getElementById('game-modal').classList.add('hidden');

// --- INITIALIZE APIS ---
const nguoiChoiAPI = createNguoiChoiAPI({ 
    getState: () => localState, // <--- SỬA DÒNG NÀY (Thêm : () => localState)
    myIdRef: () => myId, 
    roomRef, 
    update, 
    ref, 
    get, 
    push, 
    remove, 
    set, 
    roomId: ROOM_ID, 
    db, 
    initVoiceChat 
});
const dieuTraAPI = createDieuTraVienAPI({ getState: () => localState, myIdRef: () => myId, update, roomRef, shuffle, createSelectableCard, closeModal: window.closeModal });
const hungThuAPI = createHungThuAPI({ getState: () => localState, selectedCards, myIdRef: () => myId, renderGameBoard, roomRef, update });

// Export global (cho HTML onclick)
window.joinLobby = nguoiChoiAPI.joinLobby;
window.sendChatMessage = nguoiChoiAPI.sendChatMessage;
window.toggleRoleReveal = nguoiChoiAPI.toggleRoleReveal;
window.toggleEmojiPicker = nguoiChoiAPI.toggleEmojiPicker;
window.addEmoji = nguoiChoiAPI.addEmoji;
window.resetRoom = nguoiChoiAPI.resetRoom;
window.returnToLobby = nguoiChoiAPI.returnToLobby;

window.openSolveModal = dieuTraAPI.openSolveModal;
window.handleSolveAttempt = dieuTraAPI.handleSolveAttempt;
window.handleMurdererCaught = dieuTraAPI.handleMurdererCaught;
window.checkInsideManOrEndGame = dieuTraAPI.checkInsideManOrEndGame;

window.cardClick = hungThuAPI.cardClick;
window.confirmMurder = hungThuAPI.confirmMurder;
window.openKillWitnessModal = hungThuAPI.openKillWitnessModal;
window.confirmKillWitness = hungThuAPI.confirmKillWitness;

// Chat scroll fix
(function fixChatScroll() {
    const chatBox = document.getElementById('chat-messages');
    if (chatBox) {
        chatBox.addEventListener('wheel', function(e) {
            const atTop = this.scrollTop === 0;
            const atBottom = Math.abs(this.scrollHeight - this.scrollTop - this.clientHeight) < 1;
            if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom) || (this.scrollHeight <= this.clientHeight)) {
                e.preventDefault();
            }
        }, { passive: false });
    } else { setTimeout(fixChatScroll, 500); }
})();