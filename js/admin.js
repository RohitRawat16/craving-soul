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

const QR_IMAGE = "images/qr-code.png";
let isFirstLoad = true;
let allOrdersData = []; 

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    listenToRealtimeOrders();
    listenToRealtimeMenu();
    loadUpiSettings(); 
});

document.addEventListener('click', function () {
    const audio = document.getElementById('notifSound');
    if (audio) { audio.play().then(() => audio.pause()).catch(() => {}); }
}, { once: true });

function playNotification() {
    const audio = document.getElementById('notifSound');
    if (audio) { audio.currentTime = 0; audio.play().catch(e => console.log("Sound blocked by browser.")); }
}

// =====================================================
// 📱 UPI SETTINGS
// =====================================================
function loadUpiSettings() {
    db.ref('settings/upi').on('value', function(snapshot) {
        const data = snapshot.val();
        if(data) {
            if(document.getElementById('adminUpiId')) document.getElementById('adminUpiId').value = data.upiId || '';
            if(document.getElementById('adminUpiName')) document.getElementById('adminUpiName').value = data.upiName || '';
        }
    });
}

function saveUpiSettings(e) {
    e.preventDefault();
    const upiId = document.getElementById('adminUpiId').value.trim();
    const upiName = document.getElementById('adminUpiName').value.trim();
    if(!upiId || !upiName) return;
    db.ref('settings/upi').set({ upiId: upiId, upiName: upiName }).then(() => { showAdminToast('UPI Settings Saved! 📱'); });
}

// =====================================================
// 🔔 REALTIME ORDERS & SPLIT TABS LOGIC
// =====================================================
function listenToRealtimeOrders() {
    const ordersRef = db.ref('orders');
    ordersRef.on('child_added', function (snapshot) { if (!isFirstLoad) playNotification(); });
    ordersRef.on('value', function (snapshot) {
        allOrdersData = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderAllOrders(); // ⚠️ Ye dono tabs ko handle karega
        updateSalesAnalytics();
        isFirstLoad = false;
    });
}

function renderAllOrders() {
    const activeContainer = document.getElementById('ordersContainer');
    const historyContainer = document.getElementById('completedOrdersContainer');
    const activeSearch = document.getElementById('orderSearch') ? document.getElementById('orderSearch').value.toLowerCase() : '';
    const historySearch = document.getElementById('historySearch') ? document.getElementById('historySearch').value.toLowerCase() : '';

    // Stats
    const activeCount = allOrdersData.filter(o => o.status !== 'completed').length;
    const totalEarnings = allOrdersData.filter(o => o.status === 'completed' || o.status === 'ready').reduce((sum, o) => sum + o.total, 0);
    if(document.getElementById('activeOrders')) document.getElementById('activeOrders').textContent = activeCount;
    if(document.getElementById('totalEarnings')) document.getElementById('totalEarnings').textContent = totalEarnings;

    // SPLIT DATA
    let activeOrders = allOrdersData.filter(o => o.status !== 'completed');
    let completedOrders = allOrdersData.filter(o => o.status === 'completed');

    // APPLY SEARCH
    if(activeSearch) activeOrders = activeOrders.filter(o => o.id.toString().includes(activeSearch) || (o.customerName && o.customerName.toLowerCase().includes(activeSearch)));
    if(historySearch) completedOrders = completedOrders.filter(o => o.id.toString().includes(historySearch) || (o.customerName && o.customerName.toLowerCase().includes(historySearch)));

    // SORT LATEST FIRST
    activeOrders.sort((a, b) => b.timestamp - a.timestamp);
    completedOrders.sort((a, b) => b.timestamp - a.timestamp);

    // RENDER ACTIVE
    if(activeOrders.length === 0) {
        activeContainer.innerHTML = `<div class="no-orders"><i class="fas fa-inbox"></i><h3>No active orders</h3></div>`;
    } else {
        let activeHtml = '';
        activeOrders.forEach(order => { activeHtml += generateOrderCardHTML(order); });
        activeContainer.innerHTML = activeHtml;
    }

    // RENDER HISTORY
    if(completedOrders.length === 0) {
        historyContainer.innerHTML = `<div class="no-orders"><i class="fas fa-history"></i><h3>No completed orders</h3></div>`;
    } else {
        let historyHtml = '';
        completedOrders.forEach(order => { historyHtml += generateOrderCardHTML(order); });
        historyContainer.innerHTML = historyHtml;
    }
}

function generateOrderCardHTML(order) {
    const time = new Date(order.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isCompleted = order.status === 'completed';

    const badges = {
        received: '<span class="order-status-badge badge-received"><i class="fas fa-inbox"></i> Received</span>',
        preparing: '<span class="order-status-badge badge-preparing"><i class="fas fa-fire"></i> Preparing</span>',
        ready: '<span class="order-status-badge badge-ready"><i class="fas fa-check-circle"></i> Ready</span>',
        completed: '<span class="order-status-badge badge-completed"><i class="fas fa-flag-checkered"></i> Completed</span>'
    };

    let paymentBadge = ''; let verifyButton = ''; let highlightStyle = '';

    if (order.payment === 'upi') {
        if (order.paymentStatus === 'verified') {
            paymentBadge = '<span class="order-payment-badge pay-upi" style="color:#4ADE80; border:1px solid #4ADE80;"><i class="fas fa-check-circle"></i> UPI Verified ✅</span>';
        } else if (order.paymentStatus === 'claimed_paid') {
            highlightStyle = 'border: 2px solid #FACC15; box-shadow: 0 0 20px rgba(250, 204, 21, 0.2); background: rgba(250, 204, 21, 0.05);';
            paymentBadge = `<span class="order-payment-badge pay-warning"><i class="fas fa-exclamation-triangle"></i> Check Phone: ₹${order.total}</span>`;
            if(!isCompleted) verifyButton = `<button class="order-btn btn-verify" onclick="verifyPayment(${order.id})"><i class="fas fa-check-double"></i> Verify Payment Received</button>`;
        } else {
            paymentBadge = '<span class="order-payment-badge pay-upi"><i class="fas fa-mobile-screen"></i> UPI Pending</span>';
        }
    } else {
        paymentBadge = '<span class="order-payment-badge pay-cash"><i class="fas fa-money-bill-wave"></i> Cash to Collect</span>';
    }

    let itemsHtml = '';
    order.items.forEach(item => { itemsHtml += `<div class="order-item-row"><span>${item.name}</span><span class="order-item-qty">×${item.qty} = ₹${item.price * item.qty}</span></div>`; });

    let actions = '';
    if (!isCompleted) {
        if (order.status === 'received') actions += `<button class="order-btn btn-preparing" onclick="updateOrderStatus(${order.id}, 'preparing')"><i class="fas fa-fire"></i> Start Preparing</button>`;
        if (order.status === 'preparing') actions += `<button class="order-btn btn-ready" onclick="updateOrderStatus(${order.id}, 'ready')"><i class="fas fa-bell-concierge"></i> Mark Ready</button>`;
        if (order.status === 'ready') actions += `<button class="order-btn btn-done" onclick="updateOrderStatus(${order.id}, 'completed')"><i class="fas fa-flag-checkered"></i> Complete Order</button>`;
        if (order.payment === 'cash') actions += `<button class="order-btn btn-pay-now" onclick="showPayNow(${order.id}, ${order.total})"><i class="fas fa-qrcode"></i> Show QR (₹${order.total})</button>`;
    }
    
    // Delete is available in both tabs
    actions += `<button class="order-btn btn-delete-order" onclick="deleteOrder(${order.id})"><i class="fas fa-trash"></i> Delete</button>`;

    return `
        <div class="order-card status-${order.status}" id="order-${order.id}" style="${highlightStyle}">
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
}

function verifyPayment(orderId) { if(confirm("Did you check your PhonePe/Paytm and received the money?")) { db.ref('orders/' + orderId).update({ paymentStatus: 'verified' }); showAdminToast('Payment Verified! ✅'); } }
function updateOrderStatus(orderId, newStatus) { db.ref('orders/' + orderId).update({ status: newStatus }); }
function deleteOrder(orderId) { if (confirm(`Delete Order #${orderId}?`)) db.ref('orders/' + orderId).remove(); }
function showPayNow(orderId, total) { document.getElementById('adminQrImg').src = QR_IMAGE; document.getElementById('adminPayAmount').textContent = `₹${total}`; document.getElementById('adminPayModal').style.display = 'flex'; }
function closeAdminPayModal() { document.getElementById('adminPayModal').style.display = 'none'; }

// =====================================================
// 📊 SALES ANALYTICS LOGIC
// =====================================================
function updateSalesAnalytics() {
    const itemStats = {};
    allOrdersData.forEach(order => {
        if(order.items) {
            order.items.forEach(item => {
                if(!itemStats[item.name]) itemStats[item.name] = { qty: 0, revenue: 0 };
                itemStats[item.name].qty += item.qty; itemStats[item.name].revenue += (item.price * item.qty);
            });
        }
    });

    const grid = document.getElementById('analyticsGrid'); if(!grid) return;
    if(Object.keys(itemStats).length === 0) { grid.innerHTML = '<p style="text-align:center;color:#888;padding:30px;">No sales data available yet.</p>'; return; }

    const sortedStats = Object.keys(itemStats).map(name => { return { name: name, ...itemStats[name] }; }).sort((a, b) => b.revenue - a.revenue);
    let html = '';
    sortedStats.forEach((stat, index) => {
        let rankColor = index === 0 ? '#FACC15' : (index === 1 ? '#94A3B8' : (index === 2 ? '#D97706' : '#3F3F46'));
        let rankText = index === 0 ? '<i class="fas fa-trophy"></i>' : `#${index + 1}`;
        html += `<div class="analytics-card"><div class="analytics-rank" style="background:${rankColor};">${rankText}</div><div class="analytics-info"><div class="analytics-name">${stat.name}</div><div class="analytics-qty">Sold: <span>${stat.qty} units</span></div></div><div class="analytics-amount"><div class="analytics-label">Total Revenue</div><div class="analytics-revenue">₹${stat.revenue}</div></div></div>`;
    });
    grid.innerHTML = html;
}

// =====================================================
// 📋 MENU MANAGER (ADD, DELETE, EDIT ✏️)
// =====================================================
function listenToRealtimeMenu() {
    db.ref('menu').on('value', function (snapshot) {
        const list = document.getElementById('menuList'); if(!list) return;
        const menuData = snapshot.val();
        if (!menuData) { list.innerHTML = '<p style="text-align:center; color:#555; padding:30px;">No items in menu.</p>'; return; }
        
        let html = '';
        Object.keys(menuData).forEach(key => {
            const item = menuData[key];
            // Escape strings for onclick
            const safeName = item.name.replace(/'/g, "\\'");
            const safeDesc = (item.desc || '').replace(/'/g, "\\'");
            const safeImage = (item.image || '').replace(/'/g, "\\'");

            html += `
                <div class="menu-list-item">
                    <img src="${item.image}" onerror="this.src='https://via.placeholder.com/60/1a1a2e/FF5A00?text=Food'">
                    <div class="menu-list-details">
                        <div class="menu-list-name">${item.name}</div>
                        <div class="menu-list-desc">${item.desc}</div>
                    </div>
                    <span class="menu-list-price">₹${item.price}</span>
                    <div class="menu-actions-right">
                        <button class="btn-edit-item" onclick="openEditModal('${key}', '${safeName}', ${item.price}, '${safeDesc}', '${safeImage}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete-item" onclick="deleteMenuItem('${key}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
        list.innerHTML = html;
    });
}

function addMenuItem(e) {
    e.preventDefault();
    const name = document.getElementById('itemName').value.trim(); const price = parseInt(document.getElementById('itemPrice').value); const desc = document.getElementById('itemDesc').value.trim();
    const image = document.getElementById('itemImage').value.trim() || `https://via.placeholder.com/400x200/1A1A22/FF5A00?text=${encodeURIComponent(name)}`;
    if (!name || !price || !desc) return;
    
    db.ref('menu').push().set({ name: name, desc: desc, price: price, image: image }).then(() => {
        document.getElementById('addItemForm').reset(); showAdminToast(`${name} added! ✅`);
    });
}

function deleteMenuItem(itemKey) { if (confirm('Delete this item?')) db.ref('menu/' + itemKey).remove().then(() => showAdminToast('Deleted! 🗑️')); }

// ✏️ NAYA: EDIT MODAL LOGIC
function openEditModal(key, name, price, desc, image) {
    document.getElementById('editItemKey').value = key;
    document.getElementById('editItemName').value = name;
    document.getElementById('editItemPrice').value = price;
    document.getElementById('editItemDesc').value = desc;
    document.getElementById('editItemImage').value = image;
    document.getElementById('editItemModal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('editItemModal').style.display = 'none'; }

function saveEditedItem(e) {
    e.preventDefault();
    const key = document.getElementById('editItemKey').value;
    const name = document.getElementById('editItemName').value.trim();
    const price = parseInt(document.getElementById('editItemPrice').value);
    const desc = document.getElementById('editItemDesc').value.trim();
    const image = document.getElementById('editItemImage').value.trim();

    db.ref('menu/' + key).update({
        name: name,
        price: price,
        desc: desc,
        image: image
    }).then(() => {
        closeEditModal();
        showAdminToast('Item Updated Successfully! ✏️');
    });
}

// UTILS
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
