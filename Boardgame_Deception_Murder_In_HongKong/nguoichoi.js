import { leaveVoiceChat } from "./voiceChat.js"; // Sửa tên file từ voice.js sang voiceChat.js

export function createNguoiChoiAPI({ getState, myIdRef, roomRef, update, ref, get, push, remove, set, roomId, db, initVoiceChat }) {
    const joinLobby = (nameParam) => {
    const inputEl = document.getElementById('username-input');
    const name = nameParam || inputEl?.value?.trim();
    if (!name) return alert("Nhập tên trước khi tham gia!");

    get(roomRef).then((snapshot) => {
        let updates = {};
        const uid = myIdRef();
        
        if (!snapshot.exists()) {
            // TRƯỜNG HỢP 1: TẠO PHÒNG MỚI (Dành cho Host)
            const isHost = true;
            updates = {
                status: 'LOBBY',
                config: { voiceEnabled: true }, // Khởi tạo config mặc định
                players: {
                    [uid]: { id: uid, name, isHost: true }
                }
            };
            // Sử dụng set để khởi tạo toàn bộ cấu trúc phòng thay vì update
            set(roomRef, updates).then(() => {
                if (initVoiceChat) initVoiceChat(roomId, uid);
            });
        } else {
            // TRƯỜNG HỢP 2: THAM GIA PHÒNG ĐÃ CÓ (Dành cho Người chơi)
            const roomData = snapshot.val();
            
            // Kiểm tra nếu phòng đang trong trận (không cho vào)
            if (roomData.status !== 'LOBBY') {
                alert("Phòng đang trong trận đấu, không thể tham gia!");
                return;
            }

            const pList = roomData.players ? Object.values(roomData.players) : [];
            if (pList.length >= 18) {
                alert("Phòng đã đầy!");
                return;
            }

            // Thêm người chơi vào danh sách
            updates[`players/${uid}`] = { id: uid, name, isHost: false };
            
            update(roomRef, updates).then(() => {
                if (initVoiceChat) initVoiceChat(roomId, uid);
            });
        }
    }).catch(err => {
        console.error("Lỗi Firebase:", err);
        alert("Lỗi kết nối máy chủ!");
    });
};

    const sendChatMessage = () => {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        const state = getState();
        const me = state?.players?.[myIdRef()];

        if (!text || !me) return;

        push(ref(db, `rooms/${roomId}/chat`), {
            senderId: myIdRef(),
            senderName: me.name,
            text: text,
            timestamp: Date.now()
        });

        input.value = '';
        input.focus();
    };

    const toggleRoleReveal = () => {
        const overlay = document.getElementById('my-role-overlay');
        if (!overlay) return;
        overlay.style.opacity = (overlay.style.opacity === '0') ? '1' : '0';
        overlay.style.pointerEvents = (overlay.style.opacity === '0') ? 'auto' : 'none';
    };

    const toggleEmojiPicker = () => {
        const picker = document.getElementById('emoji-picker');
        if (!picker) return;
        picker.classList.toggle('hidden');
    };

    const addEmoji = (emoji) => {
        const input = document.getElementById('chat-input');
        if (!input) return;
        input.value += emoji;
        input.focus();
        const picker = document.getElementById('emoji-picker');
        if (picker) picker.classList.add('hidden');
    };

    const resetRoom = () => {
        if (confirm("Reset phòng?")) remove(roomRef).then(() => location.reload());
    };

    const returnToLobby = () => {
        const state = getState();
        leaveVoiceChat();
        if (!state?.players) return;
        const uid = myIdRef();
        // Xóa người chơi khỏi phòng, không reset toàn bộ phòng
        const updates = {
            [`players/${uid}`]: null
        };
        update(roomRef, updates);
    };

    return {
        joinLobby,
        sendChatMessage,
        toggleRoleReveal,
        toggleEmojiPicker,
        addEmoji,
        resetRoom,
        returnToLobby
    };
}

