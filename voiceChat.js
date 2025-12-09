// --- FILE: voiceChat.js ---
const APP_ID = "a77edb701fcd4534aa2b8a8668eae0ee"; // App ID của bạn

let client = null;
let localAudioTrack = null;
let isMicOn = false;   // MẶC ĐỊNH TẮT MIC
let isDeafened = false;
let currentRoomId = null;
let currentUid = null;

const checkAgora = () => {
    if (typeof AgoraRTC === 'undefined') {
        console.error("Agora SDK chưa được tải!");
        return false;
    }
    return true;
};

// --- HÀM MỚI: QUẢN LÝ KẾT NỐI TỔNG ---
window.toggleVoiceConnection = async () => {
    const powerBtn = document.getElementById('btn-power');
    
    // Nếu đang kết nối -> Thì ngắt kết nối
    if (client && client.connectionState === 'CONNECTED') {
        await leaveVoiceChat();
        if(powerBtn) {
            powerBtn.classList.remove('bg-red-600', 'hover:bg-red-500');
            powerBtn.classList.add('bg-green-600', 'hover:bg-green-500');
            powerBtn.innerHTML = '📞'; // Icon gọi
            powerBtn.title = "Tham gia Voice Chat";
        }
    } 
    // Nếu chưa kết nối -> Thì kết nối
    else {
        if (!currentRoomId || !currentUid) {
            alert("Chưa có thông tin phòng! Hãy đợi vào game.");
            return;
        }
        
        if(powerBtn) powerBtn.innerHTML = '⌛'; // Loading...
        
        await initVoiceChat(currentRoomId, currentUid);
        
        if(powerBtn) {
            powerBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
            powerBtn.classList.add('bg-red-600', 'hover:bg-red-500');
            powerBtn.innerHTML = '☎️'; // Icon dập máy
            powerBtn.title = "Ngắt kết nối Voice";
        }
    }
};

export async function initVoiceChat(roomId, uid) {
    if (!checkAgora()) return;
    
    // Lưu thông tin để dùng cho việc Reconnect sau này
    currentRoomId = roomId;
    currentUid = uid;

    // Hiển thị khung Voice Control (nhưng chưa hiện nút Mic/Loa vội)
    const controlPanel = document.getElementById('voice-controls');
    if (controlPanel) controlPanel.classList.remove('hidden');

    // Nếu đã kết nối rồi thì thôi
    if (client && client.connectionState === 'CONNECTED') return;

    try {
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        client.on("user-published", async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === "audio") {
                const remoteAudioTrack = user.audioTrack;
                if (!isDeafened) remoteAudioTrack.play();
            }
        });

        client.on("user-unpublished", (user) => { /* Xử lý khi ai đó tắt mic nếu cần */ });

        await client.join(APP_ID, roomId, null, uid);
        window.hasJoinedVoice = true;

        // Tạo track Mic nhưng SET FALSE NGAY LẬP TỨC (Mute mặc định)
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        isMicOn = false; 
        await localAudioTrack.setEnabled(false);
        
        await client.publish([localAudioTrack]);

        console.log("Voice Chat: Connected (Muted default)");

        // Cập nhật UI: Hiện các nút Mic/Loa
        const actionsDiv = document.getElementById('voice-actions');
        if (actionsDiv) actionsDiv.classList.remove('hidden');

        // Cập nhật trạng thái nút
        updateMicUI(false); 
        updateDeafenUI(false);
        startVolumeIndicator();

    } catch (error) {
        console.error("Lỗi kết nối Voice:", error);
        alert("Lỗi kết nối Voice Chat (Kiểm tra Mic của bạn).");
        // Reset nút nguồn về trạng thái chưa kết nối nếu lỗi
        const powerBtn = document.getElementById('btn-power');
        if(powerBtn) {
            powerBtn.innerHTML = '📞';
            powerBtn.classList.add('bg-green-600');
            powerBtn.classList.remove('bg-red-600');
        }
    }
}

export async function leaveVoiceChat() {
    if (localAudioTrack) {
        localAudioTrack.close();
        localAudioTrack = null;
    }
    if (client) {
        await client.leave();
        client = null;
    }
    window.hasJoinedVoice = false;
    
    // Ẩn các nút Mic/Loa, chỉ giữ nút Nguồn
    const actionsDiv = document.getElementById('voice-actions');
    if (actionsDiv) actionsDiv.classList.add('hidden');
    
    console.log("Voice Chat: Disconnected");
}

// --- CÁC HÀM UI ---

window.toggleMic = async () => {
    if (!localAudioTrack) return;
    isMicOn = !isMicOn;
    await localAudioTrack.setEnabled(isMicOn);
    updateMicUI(isMicOn);
};

window.toggleDeafen = () => {
    if (!client) return;
    isDeafened = !isDeafened;
    
    // Tắt tiếng người khác cục bộ
    client.remoteUsers.forEach(user => {
        if (user.audioTrack) {
            isDeafened ? user.audioTrack.stop() : user.audioTrack.play();
        }
    });
    updateDeafenUI(isDeafened);
};

function updateMicUI(isOn) {
    const btn = document.getElementById('btn-mic');
    if (btn) {
        btn.innerHTML = isOn ? '🎤' : '🚫';
        btn.classList.toggle('bg-red-600', !isOn); // Đỏ nếu tắt
        btn.classList.toggle('bg-gray-700', isOn); // Xám nếu bật
    }
}

function updateDeafenUI(isDeaf) {
    const btn = document.getElementById('btn-deafen');
    if (btn) {
        btn.innerHTML = isDeaf ? '🔇' : '🔊';
        btn.classList.toggle('bg-red-600', isDeaf);
        btn.classList.toggle('bg-gray-700', !isDeaf);
    }
}

function startVolumeIndicator() {
    setInterval(() => {
        if (localAudioTrack && isMicOn) {
            const level = localAudioTrack.getVolumeLevel();
            const indicator = document.getElementById('speaking-indicator');
            if (indicator) {
                indicator.style.backgroundColor = level > 0.05 ? '#48bb78' : '#2d3748';
                indicator.style.boxShadow = level > 0.05 ? '0 0 8px #48bb78' : 'none';
            }
        }
    }, 200);
}