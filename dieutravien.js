export function createDieuTraVienAPI({ getState, myIdRef, update, roomRef, shuffle, createSelectableCard, closeModal }) {
    const openSolveModal = () => {
        const state = getState();
        const me = state.players[myIdRef()];
        if (!me?.canSolve && me?.role?.id !== 'FORENSIC') return alert("Bạn đã mất quyền Phá Án!");
        if (me.role.id === 'FORENSIC') return alert("Pháp Y không được phá án!");

        const modal = document.getElementById('game-modal');
        const content = document.getElementById('modal-content');
        const title = document.getElementById('modal-title');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        
        modal.classList.remove('hidden');
        title.innerText = "🕵️ ĐƯA RA KẾT LUẬN CỦA BẠN";
        let solveSelection = { targetId: null, mean: null, clue: null };

        const isSmartAccomplice = (me.role.id === 'SMART_ACCOMPLICE');

        if (isSmartAccomplice) {
             let allMeansHTML = '';
             let allCluesHTML = '';
             Object.values(state.players).forEach(p => {
                 if (p.role.id === 'FORENSIC') return;
                 p.hand.means.forEach(card => {
                     allMeansHTML += createSelectableCard(card, 'mean', p.name, p.id);
                 });
                 p.hand.clues.forEach(card => {
                     allCluesHTML += createSelectableCard(card, 'clue', p.name, p.id);
                 });
             });

             content.innerHTML = `
                 <p class="text-sm text-yellow-500 mb-2 italic">Bạn là TP Thông Minh: Có thể chọn Hung khí và Tang vật từ 2 người khác nhau.</p>
                 <div class="mb-4"><h4 class="font-bold text-brand-blue mb-2">Chọn 1 Hung Khí:</h4><div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">${allMeansHTML}</div></div>
                 <div class="mb-4"><h4 class="font-bold text-brand-red mb-2">Chọn 1 Vật Chứng:</h4><div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">${allCluesHTML}</div></div>
             `;
        } else {
            const pList = Object.values(state.players).filter(p => p.role.id !== 'FORENSIC' && p.id !== myIdRef());
            content.innerHTML = `
                <div class="mb-4">
                    <label class="block text-gray-400 mb-2">Hung thủ là ai?</label>
                    <select id="target-select" class="w-full bg-gray-700 p-2 rounded text-white border border-gray-600 focus:border-brand-blue outline-none">
                        <option value="">-- Chọn người chơi --</option>
                        ${pList.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div id="target-cards-area" class="hidden"></div>
            `;
            
            setTimeout(() => {
                const select = document.getElementById('target-select');
                if(select) select.onchange = (e) => {
                    const pid = e.target.value;
                    solveSelection.targetId = pid;
                    const target = state.players[pid];
                    const area = document.getElementById('target-cards-area');
                    if (!target) { area.classList.add('hidden'); return; }
                    area.classList.remove('hidden');
                    area.innerHTML = `
                        <div class="mb-2"><h4 class="text-brand-blue text-xs font-bold uppercase mb-1">Hung Khí</h4>
                        <div class="grid grid-cols-2 gap-2">${target.hand.means.map(c => createSelectableCard(c, 'mean')).join('')}</div></div>
                        <div class="mb-2"><h4 class="text-brand-red text-xs font-bold uppercase mb-1">Vật Chứng</h4>
                        <div class="grid grid-cols-2 gap-2">${target.hand.clues.map(c => createSelectableCard(c, 'clue')).join('')}</div></div>
                    `;
                };
            }, 100);
        }

        window.tempSelect = (el, type, val) => {
            document.querySelectorAll(`.select-card-${type}`).forEach(e => e.classList.remove('ring-2', 'ring-white', 'bg-gray-600'));
            el.classList.add('ring-2', 'ring-white', 'bg-gray-600');
            solveSelection[type] = val;
        };

        confirmBtn.onclick = () => {
            if (!solveSelection.mean || !solveSelection.clue) return alert("Vui lòng chọn đủ Hung khí và Vật chứng!");
            handleSolveAttempt(solveSelection);
            closeModal();
        };
    };

    const handleSolveAttempt = (selection) => {
        const state = getState();
        const crime = state.crime;
        const me = state.players[myIdRef()];
        const isCorrect = (selection.mean === crime.mean && selection.clue === crime.clue);

        if (isCorrect) {
            const scapegoat = Object.values(state.players).find(p => p.role.id === 'SCAPEGOAT');
            const murderer = Object.values(state.players).find(p => p.role.id === 'MURDERER');
            
            if (scapegoat && !scapegoat.isRevealed && selection.targetId === murderer.id) {
                 update(roomRef, {
                     [`players/${scapegoat.id}/isRevealed`]: true,
                     [`players/${myIdRef()}/canSolve`]: false,
                     phase: 'PENALTY_STEP',
                     lastActionMsg: `⚠️ ${me.name} tố cáo Sát Nhân, nhưng hắn CƯỜI KHẨY! (Kẻ Thế Mạng đã đỡ đòn)`
                 });
            } else {
                 handleMurdererCaught();
            }
        } else {
            update(roomRef, { 
                [`players/${myIdRef()}/canSolve`]: false,
                phase: 'PENALTY_STEP',
                lastActionMsg: `❌ ${me.name} PHÁ ÁN SAI! Hung thủ vẫn nhởn nhơ.`
            });
        }
    };

    const handleMurdererCaught = () => {
        const state = getState();
        const witness = Object.values(state.players).find(p => p.role.id === 'WITNESS');
        
        if (witness) {
            update(roomRef, {
                phase: 'MURDERER_LAST_CHANCE',
                lastActionMsg: '😱 Sát nhân đã bị lộ! Hắn đang điên cuồng tìm giết NHÂN CHỨNG để lật kèo!'
            });
        } else {
            checkInsideManOrEndGame();
        }
    };

    const checkInsideManOrEndGame = () => {
        const state = getState();
        const insideMan = Object.values(state.players).find(p => p.role.id === 'INSIDE_MAN');
        
        if (insideMan && !insideMan.isAccused) {
            const lostBadgePlayers = Object.values(state.players).filter(p => !p.canSolve && p.role.id !== 'FORENSIC');
            const luckyPlayers = shuffle(lostBadgePlayers).slice(0, 3);
            const updates = {};
            const newCrime = { mean: insideMan.hand.means[0].vi, clue: insideMan.hand.clues[0].vi };
            
            updates[`crime`] = newCrime;
            updates[`status`] = 'PLAYING';
            updates[`phase`] = 'DAY_DISCUSSION';
            updates[`lastActionMsg`] = `😱 Sát nhân đã sa lưới, NHƯNG ÁC MỘNG CHƯA DỨT! Một kẻ khác đã tiếp quản cuộc chơi...`;
            luckyPlayers.forEach(p => { updates[`players/${p.id}/canSolve`] = true; });
            updates[`players/${insideMan.id}/role/id`] = 'MURDERER'; 
            update(roomRef, updates);
        } else {
            update(roomRef, { status: 'END_GAME', phase: 'END_GAME', winner: 'BLUE', lastActionMsg: '🎉 CÔNG LÝ ĐÃ ĐƯỢC THỰC THI! SÁT NHÂN ĐÃ BỊ BẮT!' });
        }
    };

    return {
        openSolveModal,
        handleSolveAttempt,
        handleMurdererCaught,
        checkInsideManOrEndGame
    };
}

