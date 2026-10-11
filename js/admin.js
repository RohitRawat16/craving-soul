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

// =====================================================
// ⚠️ APNA UPI ID ZAROOR CHANGE KARNA
// =====================================================
const UPI_ID = "yourupi@paytm";         // <-- Yahan apna real Paytm / PhonePe / GPay UPI ID daal
const UPI_NAME = "Craving Soul";        // <-- Display Name
const QR_IMAGE_FALLBACK = "images/hello.png"; 

// ===== STATE =====
let cart = [];
let menuItems = [];
let currentBuyNowItem = null;
let modalQty = 1;
let selectedPayment = 'cash';
let modalPayment = 'cash';
let currentOrderId = null;
let pendingOrderData = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    listenToUpiSettings();
    initRealtimeMenu();
    loadCartFromStorage();
    updateCartUI();
    checkExistingOrder();
});

// Dynamic UPI settings from Admin Firebase DB if configured
function listenToUpiSettings() {
    db.ref('settings/upi').on('value', function(snapshot) {
        const data = snapshot.val();
        if(data) {
            if(data.upiId) UPI_ID = data.upiId;
            if(data.upiName) UPI_NAME = data.upiName;
        }
    });
}

function initRealtimeMenu() {
    db.ref('menu').on('value', function (snapshot) {
        const data = snapshot.val();
        if (data) menuItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        else seedDefaultMenu();
        renderMenu();
    });
}

function seedDefaultMenu() {
    const defaultMenu = {
        item_1: { name: "Signature Veg Burger", desc: "Crispy aloo tikki, fresh veggies & secret sauce", price: 60, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600", badge: "best" },
        item_2: { name: "Tandoori Paneer Roll", desc: "Tandoori paneer in rumali with mint chutney", price: 80, image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600", badge: "" },
        item_3: { name: "Peri-Peri Fries", desc: "Golden fries, extra crispy with spicy seasoning", price: 50, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600", badge: "" },
        item_4: { name: "Classic Cold Coffee", desc: "Creamy blended coffee with ice cream", price: 70, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600", badge: "new" },
        item_5: { name: "Delhi Chole Bhature", desc: "Spicy chole + fluffy bhature", price: 90, image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600", badge: "" },
        item_6: { name: "Steamed Momos (8pcs)", desc: "Soft veg momos with fiery red chutney", price: 60, image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600", badge: "best" }
    };
    db.ref('menu').set(defaultMenu);
}

// ===== RENDER MENU WITH DYNAMIC CARD QUANTITY SELECTOR =====
function renderMenu() {
    const grid = document.getElementById('menuGrid'); if (!grid) return; grid.innerHTML = '';
    
    if(menuItems.length === 0) { grid.innerHTML = '<p style="color:#A1A1AA;text-align:center;width:100%;">Menu is loading...</p>'; return; }

    menuItems.forEach(function (item, index) {
        const card = document.createElement('div'); card.className = 'menu-card'; card.style.animationDelay = (index * 0.05) + 's';
        const inCart = cart.find(c => c.id == item.id); const cartQty = inCart ? inCart.qty : 0;

        let badgeHTML = '';
        if (item.badge === 'best') badgeHTML = '<span class="menu-badge"><i class="fas fa-star"></i> Bestseller</span>';
        else if (item.badge === 'new') badgeHTML = '<span class="menu-badge new">New</span>';

        let actionHTML = '';
        if (cartQty > 0) {
            actionHTML = `
                <div class="card-qty-control" id="addBtnSlot-${item.id}">
                    <button onclick="updateCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                    <span>${cartQty}</span>
                    <button onclick="updateCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                </div>`;
        } else {
            actionHTML = `
                <div id="addBtnSlot-${item.id}" style="flex:1;">
                    <button class="btn-add-cart" onclick="addToCart('${item.id}')">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>`;
        }

        card.innerHTML = `
            <div class="menu-card-img-wrapper">
                ${badgeHTML}
                <img src="${item.image}" class="menu-card-img" alt="${item.name}" onerror="this.src='https://via.placeholder.com/400x300/1A1A22/FF5A00?text=Food'">
            </div>
            <div class="menu-card-body">
                <h3 class="menu-card-name">${item.name}</h3>
                <p class="menu-card-desc">${item.desc || ''}</p>
                <div class="menu-card-bottom"><p class="menu-card-price">₹${item.price}</p></div>
                <div class="menu-card-actions">
                    ${actionHTML}
                    <button class="btn-buy-now" onclick="openBuyNow('${item.id}')"><i class="fas fa-bolt"></i> Buy</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

function addToCart(itemId) {
    const item = menuItems.find(i => i.id == itemId); if (!item) return;
    const existing = cart.find(c => c.id == itemId);
    if (existing) existing.qty += 1; else cart.push({ id: item.id, name: item.name, price: item.price, image: item.image, qty: 1 });
    saveCartToStorage(); updateCartUI(); updateMenuButtons(); showToast(`${item.name} added! 🍔`);
}

function updateMenuButtons() {
    menuItems.forEach(item => {
        const slot = document.getElementById(`addBtnSlot-${item.id}`); if (!slot) return;
        const inCart = cart.find(c => c.id == item.id); const cartQty = inCart ? inCart.qty : 0;

        if (cartQty > 0) {
            slot.className = 'card-qty-control';
            slot.style.flex = '1';
            slot.innerHTML = `
                <button onclick="updateCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                <span>${cartQty}</span>
                <button onclick="updateCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
            `;
        } else {
            slot.className = '';
            slot.style.flex = '1';
            slot.innerHTML = `
                <button class="btn-add-cart" onclick="addToCart('${item.id}')">
                    <i class="fas fa-plus"></i> Add
                </button>
            `;
        }
    });
}

function saveCartToStorage() { localStorage.setItem('stall_cart', JSON.stringify(cart)); }
function loadCartFromStorage() { const stored = localStorage.getItem('stall_cart'); if (stored) { try { cart = JSON.parse(stored); } catch (e) { cart = []; } } }
function toggleCart() { document.getElementById('cartSidebar').classList.toggle('show'); document.getElementById('cartOverlay').classList.toggle('show'); }

function updateCartUI() {
    const countEl = document.getElementById('cartCount'); const itemsEl = document.getElementById('cartItems'); 
    const footerEl = document.getElementById('cartFooter'); const totalEl = document.getElementById('cartTotal'); 
    const subtitleEl = document.getElementById('cartSubtitle');
    
    const floatBar = document.getElementById('floatCartBar'); const floatCount = document.getElementById('floatCount'); 
    const floatTotal = document.getElementById('floatTotal'); const floatItemsText = document.getElementById('floatItemsText');

    let totalItems = 0; let totalPrice = 0;
    cart.forEach(item => { totalItems += item.qty; totalPrice += item.price * item.qty; });

    if (countEl) { countEl.textContent = totalItems; countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }
    if (subtitleEl) subtitleEl.textContent = `${totalItems} items`;

    if (cart.length === 0) {
        if (itemsEl) itemsEl.innerHTML = `<div class="empty-cart"><i class="fas fa-shopping-bag"></i><h3>Bag is empty</h3><p>Add something delicious 🔥</p></div>`;
        if (footerEl) footerEl.style.display = 'none';
        if (floatBar) floatBar.style.display = 'none';
        return;
    }

    if (footerEl) footerEl.style.display = 'block';
    let html = '';
    cart.forEach(item => {
        html += `<div class="cart-item"><img src="${item.image}" onerror="this.src='https://via.placeholder.com/55'"><div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-price-each">₹${item.price} each</div><div class="cart-item-subtotal">₹${item.price * item.qty}</div></div><div class="cart-item-right"><div class="qty-control"><button onclick="updateCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button><span>${item.qty}</span><button onclick="updateCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button></div><button class="cart-item-remove" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button></div></div>`;
    });
    if (itemsEl) itemsEl.innerHTML = html;
    if (totalEl) totalEl.textContent = `₹${totalPrice}`;

    if (floatBar) { floatBar.style.display = 'flex'; if (floatCount) floatCount.textContent = totalItems; if (floatTotal) floatTotal.textContent = `₹${totalPrice}`; if (floatItemsText) floatItemsText.textContent = totalItems === 1 ? 'item added' : 'items added'; }
}

function updateCartQty(itemId, delta) { 
    const item = cart.find(c => c.id == itemId); if (!item) return; 
    item.qty += delta; 
    if (item.qty <= 0) cart = cart.filter(c => c.id != itemId); 
    saveCartToStorage(); updateCartUI(); updateMenuButtons(); 
}

function removeFromCart(itemId) { cart = cart.filter(c => c.id != itemId); saveCartToStorage(); updateCartUI(); updateMenuButtons(); }
function selectPayment(method) { selectedPayment = method; document.getElementById('btnCash').classList.toggle('active', method === 'cash'); document.getElementById('btnUpi').classList.toggle('active', method === 'upi'); }
function selectModalPayment(method) { modalPayment = method; document.getElementById('modalBtnCash').classList.toggle('active', method === 'cash'); document.getElementById('modalBtnUpi').classList.toggle('active', method === 'upi'); }

function placeOrder() {
    if (cart.length === 0) return; let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    pendingOrderData = { items: JSON.parse(JSON.stringify(cart)), total: total, payment: selectedPayment }; showNameModal();
}

function openBuyNow(itemId) {
    const item = menuItems.find(i => i.id == itemId); if (!item) return;
    currentBuyNowItem = item; modalQty = 1; modalPayment = 'cash';
    document.getElementById('modalItemImg').src = item.image; document.getElementById('modalItemName').textContent = item.name; document.getElementById('modalItemPrice').textContent = `₹${item.price}`; document.getElementById('modalQty').textContent = '1'; document.getElementById('modalTotal').textContent = `₹${item.price}`; document.getElementById('modalBtnCash').classList.add('active'); document.getElementById('modalBtnUpi').classList.remove('active'); document.getElementById('buyNowModal').style.display = 'flex';
}

function closeBuyNow() { document.getElementById('buyNowModal').style.display = 'none'; }
function changeModalQty(delta) { modalQty += delta; if (modalQty < 1) modalQty = 1; if (modalQty > 20) modalQty = 20; document.getElementById('modalQty').textContent = modalQty; document.getElementById('modalTotal').textContent = `₹${currentBuyNowItem.price * modalQty}`; }

function buyNowOrder() {
    if (!currentBuyNowItem) return;
    const itemId = currentBuyNowItem.id; const itemName = currentBuyNowItem.name; const itemPrice = currentBuyNowItem.price; const qty = modalQty; const total = itemPrice * qty;
    closeBuyNow();
    pendingOrderData = { items: [{ id: itemId, name: itemName, price: itemPrice, qty: qty }], total: total, payment: modalPayment };
    showNameModal();
}

function showNameModal() {
    const existing = document.getElementById('nameModal'); if (existing) existing.remove();
    const modal = document.createElement('div'); modal.id = 'nameModal'; modal.className = 'modal-overlay'; modal.style.display = 'flex';
    modal.innerHTML = `<div class="modal-content" style="text-align:center;"><h2 style="color:#FF5A00; margin-bottom:5px;">Your Name?</h2><p style="color:#A1A1AA; font-size:12px; margin-bottom:15px;">We'll call your name when order is ready!</p><input type="text" id="customerNameInput" placeholder="Enter your full name..." style="width:100%; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; font-size:14px; text-align:center; margin-bottom:15px; outline:none;" onfocus="this.style.borderColor='#FF5A00'"><button class="checkout-btn" onclick="submitNameAndProceed()">Proceed <i class="fas fa-arrow-right"></i></button></div>`;
    document.body.appendChild(modal); setTimeout(() => document.getElementById('customerNameInput').focus(), 300);
    document.getElementById('customerNameInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitNameAndProceed(); });
}

function submitNameAndProceed() {
    const name = document.getElementById('customerNameInput').value.trim(); if (!name) return showToast('Please enter your name! ✏️');
    document.getElementById('nameModal').remove();
    if (pendingOrderData.payment === 'upi') initiateUPIPayment(pendingOrderData.total, name); else pushOrderToFirebase(pendingOrderData.items, pendingOrderData.total, 'cash', 'pending', name);
}

// =====================================================
// 💸 FAIL-SAFE UPI PAYMENT MODAL (DYNAMIC QR + COPY UPI)
// =====================================================
function initiateUPIPayment(amount, customerName) {
    showUPIModal(amount, customerName);
}

function showUPIModal(amount, customerName) {
    const existing = document.getElementById('upiPaymentModal');
    if (existing) existing.remove();

    // Generate Dynamic QR Code with exact bill amount
    const upiString = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Order - ' + customerName)}`;
    const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiString)}`;

    const modal = document.createElement('div');
    modal.id = 'upiPaymentModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center; max-width:380px;">
            <button class="modal-close" onclick="cancelUPIPayment()"><i class="fas fa-xmark"></i></button>
            <h2 style="color:#FF5A00; font-size:20px; margin-bottom:10px;"><i class="fas fa-qrcode"></i> Scan & Pay</h2>
            
            <div style="background:#fff; padding:12px; border-radius:16px; display:inline-block; margin-bottom:12px; box-shadow:0 8px 20px rgba(0,0,0,0.4);">
                <img src="${dynamicQrUrl}" alt="Scan QR Code" style="width:180px; height:180px; object-fit:contain; display:block;" onerror="this.src='${QR_IMAGE_FALLBACK}'">
            </div>

            <div style="font-size:28px; font-weight:900; color:#FACC15; margin-bottom:12px;">₹${amount}</div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:12px; margin-bottom:15px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <span style="font-size:12px; color:#A1A1AA; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${UPI_ID}</span>
                <button onclick="copyUpiId()" style="background:#FF5A00; border:none; color:white; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">
                    <i class="fas fa-copy"></i> Copy UPI
                </button>
            </div>

            <p style="font-size:11px; color:#A1A1AA; margin-bottom:15px;">Scan QR via GPay / PhonePe / Paytm OR Copy UPI ID & Pay</p>

            <div style="display:flex; gap:10px;">
                <button class="checkout-btn" style="background:#22C55E; box-shadow:none; flex:1;" onclick="confirmUPIPayment('${customerName}')">
                    <i class="fas fa-check"></i> I've Paid
                </button>
                <button class="checkout-btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); box-shadow:none; flex:1; color:#fff;" onclick="cancelUPIPayment()">
                    Cancel
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function copyUpiId() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
        showToast('UPI ID Copied! Paste in GPay/PhonePe 📋');
    }).catch(() => {
        showToast(`UPI ID: ${UPI_ID}`);
    });
}

function confirmUPIPayment(customerName) { 
    const modal = document.getElementById('upiPaymentModal');
    if (modal) modal.remove(); 
    pushOrderToFirebase(pendingOrderData.items, pendingOrderData.total, 'upi', 'claimed_paid', customerName); 
}

function cancelUPIPayment() { 
    const modal = document.getElementById('upiPaymentModal');
    if (modal) modal.remove(); 
    showToast('Payment Cancelled ❌'); 
    pendingOrderData = null; 
}

// =====================================================
// 🚀 PUSH ORDER TO FIREBASE
// =====================================================
function pushOrderToFirebase(items, total, paymentMethod, paymentStatus, customerName) {
    const orderId = Math.floor(1000 + Math.random() * 9000);
    const orderData = { id: orderId, customerName: customerName, items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })), total: total, payment: paymentMethod, paymentStatus: paymentStatus, status: 'received', timestamp: Date.now() };

    db.ref('orders/' + orderId).set(orderData).then(() => {
        cart = []; saveCartToStorage(); updateCartUI(); updateMenuButtons();
        document.getElementById('cartSidebar').classList.remove('show'); document.getElementById('cartOverlay').classList.remove('show');
        currentOrderId = orderId; localStorage.setItem('stall_my_order', orderId.toString()); pendingOrderData = null;
        showSuccessModal(orderId, paymentMethod, paymentStatus, customerName); listenToOrderStatus(orderId);
    });
}

function showSuccessModal(orderId, paymentMethod, paymentStatus, customerName) {
    document.getElementById('successOrderId').textContent = orderId; const payInfo = document.getElementById('paymentInfo');
    const nameLine = `<p style="margin-bottom:5px;"><i class="fas fa-user" style="color:#FF5A00;"></i> <strong>${customerName}</strong></p>`;
    if (paymentMethod === 'upi') payInfo.innerHTML = nameLine + `<p><i class="fas fa-clock" style="color:#FACC15;"></i> <strong>Verifying Payment... ⏳</strong></p>`;
    else payInfo.innerHTML = nameLine + `<p><i class="fas fa-money-bill-wave" style="color:#22C55E;"></i> Pay <strong>Cash</strong> at counter 💵</p>`;
    document.getElementById('orderSuccessModal').style.display = 'flex';
}
function closeSuccessModal() { document.getElementById('orderSuccessModal').style.display = 'none'; showStatusTracker(); }

function showStatusTracker() {
    if (!currentOrderId) return;
    db.ref('orders/' + currentOrderId).on('value', (snapshot) => {
        const order = snapshot.val(); if (!order) return;
        document.getElementById('trackOrderId').textContent = currentOrderId;
        const itemsList = order.items.map(i => `${i.name} × ${i.qty}`).join(' | ');
        let paymentText = '';
        if(order.payment === 'upi') {
            if(order.paymentStatus === 'verified') paymentText = '<span style="color:#22C55E;">UPI Verified ✅</span>'; else paymentText = '<span style="color:#FACC15;">Verifying... ⏳</span>';
        } else paymentText = 'Cash';
        document.getElementById('statusItems').innerHTML = `<p>👤 <strong>${order.customerName}</strong></p><p>📦 ${itemsList}</p><p style="margin-top:5px; font-weight:700;">Total: ₹${order.total} | ${paymentText}</p>`;
        updateStatusSteps(order.status); document.getElementById('statusTracker').style.display = 'block';
    });
}

function listenToOrderStatus(orderId) { db.ref('orders/' + orderId).on('value', (snapshot) => { const order = snapshot.val(); if (order) { updateStatusSteps(order.status); if (order.status === 'ready' && navigator.vibrate) navigator.vibrate([200, 100, 200]); } }); }
function updateStatusSteps(status) {
    const steps = ['received', 'preparing', 'ready']; const stepEls = { received: document.getElementById('step-received'), preparing: document.getElementById('step-preparing'), ready: document.getElementById('step-ready') }; const lines = { 0: document.getElementById('line1'), 1: document.getElementById('line2') };
    const currentIndex = steps.indexOf(status); if (currentIndex === -1) return;
    for (let key in stepEls) if (stepEls[key]) stepEls[key].classList.remove('active'); for (let key in lines) if (lines[key]) lines[key].classList.remove('active');
    for (let i = 0; i <= currentIndex; i++) { if (stepEls[steps[i]]) stepEls[steps[i]].classList.add('active'); if (i > 0 && lines[i - 1]) lines[i - 1].classList.add('active'); }
}

function closeStatus() { document.getElementById('statusTracker').style.display = 'none'; }
function checkExistingOrder() { const savedOrderId = localStorage.getItem('stall_my_order'); if (savedOrderId) { currentOrderId = parseInt(savedOrderId); showStatusTracker(); } }

function showToast(message) {
    const container = document.getElementById('toastContainer'); if (!container) return;
    const toast = document.createElement('div'); toast.className = 'toast'; toast.innerHTML = message; container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250); }, 2500);
}
