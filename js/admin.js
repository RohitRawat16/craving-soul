// =====================================================
// ⚠️ FIREBASE CONFIGURATION
// =====================================================
const firebaseConfig = {
    apiKey: "AIzaSyDyAC2ZQ3FgCapLpTDTmWHk70yhFb71zes",
    authDomain: "stall-orders.firebaseapp.com",
    databaseURL: "https://stall-orders-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stall-orders",
    storageBucket: "stall-orders.firebasestorage.app",
    messagingSenderId: "544612301850",
    appId: "1:544612301850:web:ef6be0f2b69abb049aa5a3",
    measurementId: "G-XEM6V10076"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const QR_IMAGE = "images/qr-code.png"; // Admin ke Pay Now fallback ke liye
let isFirstLoad = true;
let allOrdersData = []; 

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    listenToRealtimeOrders();
    listenToRealtimeMenu();
});

document.addEventListener('click', function () {
    const audio = document.getElementById('notifSound');
    if (audio) { audio.play().then(() => audio.pause()).catch(() => {}); }
}, { once: true });

function playNotification() {
    const audio = document.getElementById('notifSound');
    if (audio) { audio.currentTime = 0; audio.play().catch(e => console.log("Sound blocked by browser. Click anywhere first.")); }
}

// =====================================================
// 🔔 REALTIME ORDERS & SEARCH & ANALYTICS
// =====================================================
function listenToRealtimeOrders() {
    const ordersRef = db.ref('orders');

    ordersRef.on('child_added', function (snapshot) {
        if (!isFirstLoad) playNotification();
    });

    ordersRef.on('value', function (snapshot) {
        allOrdersData = snapshot.val() ? Object.values(snapshot.val()) : [];
        filterOrders(); // Renders orders
        updateSalesAnalytics(); // 📊 NAYA: Updates Sales Data
        isFirstLoad = false;
    });
}

function filterOrders() {
    const container = document.getElementById('ordersContainer');
    const searchQuery = document.getElementById('orderSearch').value.toLowerCase();

    const activeCount = allOrdersData.filter(o => o.status !== 'completed').length;
    const totalEarnings = allOrdersData
        .filter(o => o.status === 'completed' || o.status === 'ready')
        .reduce((sum, o) => sum + o.total, 0);

    document.getElementById('activeOrders').textContent = activeCount;
    document.getElementById('totalEarnings').textContent = totalEarnings;

    if (allOrdersData.length === 0) {
        container.innerHTML = `<div class="no-orders"><i class="fas fa-inbox"></i><h3>No orders yet</h3><p>Waiting for customers...</p></div>`;
        return;
    }

    let filteredOrders = allOrdersData.filter(o => 
        o.id.toString().includes(searchQuery) || 
        (o.customerName && o.customerName.toLowerCase().includes(searchQuery))
    );

    const sorted = filteredOrders.sort((a, b) => {
        const statusOrder = { received: 0, preparing: 1, ready: 2, completed: 3 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return b.timestamp - a.timestamp;
    });

    let html = '';
    sorted.forEach(order => {
        const time = new Date(order.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        const badges = {
            received: '<span class="order-status-badge badge-received"><i class="fas fa-inbox"></i> Received</span>',
            preparing: '<span class="order-status-badge badge-preparing"><i class="fas fa-fire"></i> Preparing</span>',
            ready: '<span class="order-status-badge badge-ready"><i class="fas fa-check-circle"></i> Ready</span>',
            completed: '<span class="order-status-badge badge-ready"><i class="fas fa-flag-checkered"></i> Done</span>'
        };

        let paymentBadge = '';
        let verifyButton = '';

        if (order.payment === 'upi') {
            if (order.paymentStatus === 'verified') {
                paymentBadge = '<span class="order-payment-badge pay-upi"><i class="fas fa-check-circle"></i> UPI Verified ✅</span>';
            } else if (order.paymentStatus === 'claimed_paid') {
                paymentBadge = `<span class="order-payment-badge pay-warning"><i class="fas fa-exclamation-triangle"></i> Check Phone: ₹${order.total}</span>`;
                verifyButton = `<button class="order-btn btn-verify" onclick="verifyPayment(${order.id})"><i class="fas fa-check-double"></i> Verify Payment Received</button>`;
            } else {
                paymentBadge = '<span class="order-payment-badge pay-upi"><i class="fas fa-mobile-screen"></i> UPI Pending</span>';
            }
        } else {
            paymentBadge = '<span class="order-payment-badge pay-cash"><i class="fas fa-money-bill-wave"></i> Cash</span>';
        }

        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `<div class="order-item-row"><span>${item.name}</span><span class="order-item-qty">×${item.qty} = ₹${item.price * item.qty}</span></div>`;
        });

        let actions = '';
        if (order.status === 'received') actions += `<button class="order-btn btn-preparing" onclick="updateOrderStatus(${order.id}, 'preparing')"><i class="fas fa-fire"></i> Start Preparing</button>`;
        if (order.status === 'preparing') actions += `<button class="order-btn btn-ready" onclick="updateOrderStatus(${order.id}, 'ready')"><i class="fas fa-bell-concierge"></i> Mark Ready</button>`;
        if (order.status === 'ready') actions += `<button class="order-btn btn-done" onclick="updateOrderStatus(${order.id}, 'completed')"><i class="fas fa-flag-checkered"></i> Complete</button>`;
        
        if (order.status !== 'completed' && order.payment === 'cash') {
            actions += `<button class="order-btn btn-pay-now" onclick="showPayNow(${order.id}, ${order.total})"><i class="fas fa-qrcode"></i> QR (₹${order.total})</button>`;
        }
        actions += `<button class="order-btn btn-delete-order" onclick="deleteOrder(${order.id})"><i class="fas fa-trash"></i> Delete</button>`;

        html += `
            <div class="order-card status-${order.status}" id="order-${order.id}">
                <div class="order-top">
                    <span class="order-id"><i class="fas fa-receipt"></i> #${order.id}</span>
                    <span class="order-time"><i class="fas fa-clock"></i> ${time}</span>
                    ${badges[order.status] || ''}
                </div>
                <div style="margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-user" style="color:#FF5A00;"></i>
                    <span style="font-weight:700; color:#fff; font-size:16px;">${order.customerName}</span>
                </div>
                ${paymentBadge}
                <div class="order-items-list">${itemsHtml}
                    <div class="order-total-row"><span>Total</span><span class="order-total-value">₹${order.total}</span></div>
                </div>
                ${verifyButton}
                <div class="order-actions">${actions}</div>
            </div>`;
    });

    container.innerHTML = html;
}

function verifyPayment(orderId) {
    if(confirm("Did you check your PhonePe/Paytm and received the money?")) {
        db.ref('orders/' + orderId).update({ paymentStatus: 'verified' });
        showAdminToast('Payment Verified! ✅');
    }
}

function updateOrderStatus(orderId, newStatus) { db.ref('orders/' + orderId).update({ status: newStatus }); }
function deleteOrder(orderId) { if (confirm(`Delete Order #${orderId}?`)) db.ref('orders/' + orderId).remove(); }
function showPayNow(orderId, total) { document.getElementById('adminQrImg').src = QR_IMAGE; document.getElementById('adminPayAmount').textContent = `₹${total}`; document.getElementById('adminPayModal').style.display = 'flex'; }
function closeAdminPayModal() { document.getElementById('adminPayModal').style.display = 'none'; }

// =====================================================
// 📊 NAYA: SALES ANALYTICS LOGIC
// =====================================================
function updateSalesAnalytics() {
    const itemStats = {};

    // Loop through all orders to calculate sales
    allOrdersData.forEach(order => {
        // Sirf un orders ko gino jo delete nahi hue (allOrdersData me wahi aate hain jo DB me hain)
        if(order.items) {
            order.items.forEach(item => {
                if(!itemStats[item.name]) {
                    itemStats[item.name] = { qty: 0, revenue: 0 };
                }
                itemStats[item.name].qty += item.qty;
                itemStats[item.name].revenue += (item.price * item.qty);
            });
        }
    });

    const grid = document.getElementById('analyticsGrid');
    
    if(Object.keys(itemStats).length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#888;padding:30px;">No sales data available yet.</p>';
        return;
    }

    // Array me convert karo aur Revenue ke hisaab se descending sort karo (Highest revenue on top)
    const sortedStats = Object.keys(itemStats).map(name => {
        return { name: name, ...itemStats[name] };
    }).sort((a, b) => b.revenue - a.revenue);

    let html = '';
    sortedStats.forEach((stat, index) => {
        let rankColor = index === 0 ? '#FACC15' : (index === 1 ? '#94A3B8' : (index === 2 ? '#D97706' : '#3F3F46'));
        let rankText = index === 0 ? '<i class="fas fa-trophy"></i>' : `#${index + 1}`;

        html += `
            <div class="analytics-card">
                <div class="analytics-rank" style="background:${rankColor};">${rankText}</div>
                <div class="analytics-info">
                    <div class="analytics-name">${stat.name}</div>
                    <div class="analytics-qty">Sold: <span>${stat.qty} units</span></div>
                </div>
                <div class="analytics-amount">
                    <div class="analytics-label">Total Revenue</div>
                    <div class="analytics-revenue">₹${stat.revenue}</div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// =====================================================
// 📋 MENU MANAGER
// =====================================================
function listenToRealtimeMenu() {
    db.ref('menu').on('value', function (snapshot) {
        const list = document.getElementById('menuList');
        const menuData = snapshot.val();
        if (!menuData) { list.innerHTML = '<p style="text-align:center; color:#555; padding:30px;">No items in menu.</p>'; return; }
        
        let html = '';
        Object.keys(menuData).forEach(key => {
            const item = menuData[key];
            html += `<div class="menu-list-item"><img src="${item.image}" onerror="this.src='https://via.placeholder.com/60/1a1a2e/FF5A00?text=🍔'"><div class="menu-list-details"><div class="menu-list-name">${item.name}</div><div class="menu-list-desc">${item.desc}</div></div><span class="menu-list-price">₹${item.price}</span><button class="btn-delete-item" onclick="deleteMenuItem('${key}')"><i class="fas fa-trash"></i></button></div>`;
        });
        list.innerHTML = html;
    });
}

function addMenuItem(e) {
    e.preventDefault();
    const name = document.getElementById('itemName').value.trim(); const price = parseInt(document.getElementById('itemPrice').value); const desc = document.getElementById('itemDesc').value.trim();
    const image = document.getElementById('itemImage').value.trim() || `https://via.placeholder.com/400x200/1A1A22/FF5A00?text=${encodeURIComponent(name)}`;
    if (!name || !price || !desc) return;
    
    const newItemKey = db.ref('menu').push().key;
    db.ref('menu/' + newItemKey).set({ name: name, desc: desc, price: price, image: image }).then(() => {
        document.getElementById('addItemForm').reset(); showAdminToast(`${name} added! ✅`);
    });
}

function deleteMenuItem(itemKey) { if (confirm('Delete this item?')) db.ref('menu/' + itemKey).remove().then(() => showAdminToast('Deleted! 🗑️')); }

function switchTab(tab) { 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    event.currentTarget.classList.add('active'); 
    document.getElementById(`tab-${tab}`).classList.add('active'); 
}

function showAdminToast(message) {
    const existing = document.querySelector('.admin-toast'); if (existing) existing.remove();
    const toast = document.createElement('div'); toast.className = 'admin-toast'; toast.innerHTML = message;
    document.body.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}