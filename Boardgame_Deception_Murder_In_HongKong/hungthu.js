export function createHungThuAPI({ getState, selectedCards, myIdRef, renderGameBoard, roomRef, update }) {
    const cardClick = (type, value) => {
        const state = getState();
        selectedCards[type] = value;
        renderGameBoard(Object.values(state.players), state.players[myIdRef()]);
        const controls = document.getElementById('action-controls');
        if (selectedCards.mean && selectedCards.clue) {
            controls.innerHTML = `<button onclick="confirmMurder()" class="bg-brand-red text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-red-600 transition animate-bounce">☠️ GÂY ÁN NGAY</button>`;
        }
    };

    const confirmMurder = () => {
        const state = getState();
        if (!selectedCards.mean || !selectedCards.clue) return;
        update(roomRef, {
            [`crime`]: selectedCards,
            [`phase`]: 'FORENSIC_STEP_1',
            [`lastActionMsg`]: 'Hung thủ đã gây án xong. Pháp Y hãy vào việc!'
        });
    };

    const openKillWitnessModal = () => {
        const state = getState();
        const modal = document.getElementById('game-modal');
        const content = document.getElementById('modal-content');
        const title = document.getElementById('modal-title');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        modal.classList.remove('hidden');
        title.innerText = "🔫 TRUY SÁT NHÂN CHỨNG";
        title.className = "text-xl font-bold mb-4 text-red-500 border-b border-red-900 pb-2 uppercase";

        const potentialWitnesses = Object.values(state.players).filter(p => p.role.team !== 'RED' && p.role.id !== 'FORENSIC');

        content.innerHTML = `
            <div class="mb-4">
                <p class="text-gray-300 text-sm mb-4 italic">Nếu chọn ĐÚNG Nhân Chứng, phe Hung Thủ sẽ Thắng ngược. Nếu SAI, phe Điều Tra Thắng.</p>
                <label class="block text-brand-red font-bold mb-2">Ai là Nhân Chứng?</label>
                <div class="grid grid-cols-2 gap-2">
                    ${potentialWitnesses.map(p => `
                        <div onclick="selectVictim(this, '${p.id}')" class="victim-option bg-gray-700 p-3 rounded cursor-pointer hover:bg-red-900 hover:text-white border border-gray-600 transition flex items-center justify-between">
                            <span class="font-bold">${p.name}</span>
                            <span class="text-xs text-gray-400">Chọn 💀</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        window.selectedVictimId = null;

        window.selectVictim = (el, id) => {
            document.querySelectorAll('.victim-option').forEach(e => e.classList.remove('bg-red-600', 'text-white', 'ring-2', 'ring-white'));
            el.classList.add('bg-red-600', 'text-white', 'ring-2', 'ring-white');
            window.selectedVictimId = id;
        };

        confirmBtn.onclick = () => {
            if (!window.selectedVictimId) return alert("Hãy chọn một người để thủ tiêu!");
            confirmKillWitness(window.selectedVictimId);
            window.closeModal();
        };
    };

    const confirmKillWitness = (targetId) => {
        const state = getState();
        const target = state.players[targetId];
        const me = state.players[myIdRef()];

        if (target.role.id === 'WITNESS') {
            update(roomRef, { 
                status: 'END_GAME', 
                phase: 'END_GAME',
                winner: 'RED', 
                lastActionMsg: `💀 THẢM KỊCH! ${me.name} đã giết đúng NHÂN CHỨNG (${target.name}). Phe Hung Thủ Lật Kèo Chiến Thắng! 🏆` 
            });
        } else {
            update(roomRef, { 
                status: 'END_GAME', 
                phase: 'END_GAME',
                winner: 'BLUE', 
                lastActionMsg: `🛡️ KHÉP LẠI VỤ ÁN CỦA ${me.name}, Bạn hãy yên tâm (${target.name}). Phe Điều Tra Toàn Thắng! 🎉` 
            });
        }
    };

    return {
        cardClick,
        confirmMurder,
        openKillWitnessModal,
        confirmKillWitness
    };
}

