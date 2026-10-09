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
// ⚠️ APNA UPI ID ZAROOR DAAL DENA
// =====================================================
const UPI_ID = "7678355616@ibl";        // <-- Apna UPI ID
const UPI_NAME = "Craving Soul";        // <-- Naya naam
const QR_IMAGE = "images/hello.png";     // <-- Logo/QR image

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
    initRealtimeMenu();
    loadCartFromStorage();
    updateCartUI();
    checkExistingOrder();
});

// =====================================================
// 📡 REALTIME MENU
// =====================================================
function initRealtimeMenu() {
    db.ref('menu').on('value', function (snapshot) {
        const data = snapshot.val();
        if (data) {
            menuItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        } else {
            seedDefaultMenu();
        }
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

// ===== RENDER MENU =====
function renderMenu() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (menuItems.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#9A9AA3; padding:40px;">Menu is loading...</p>';
        return;
    }

    menuItems.forEach(function (item, index) {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.style.animationDelay = (index * 0.06) + 's';

        const inCart = cart.find(c => c.id == item.id);
        const cartQty = inCart ? inCart.qty : 0;
        const btnText = cartQty > 0 ? `<i class="fas fa-check"></i> In Cart (${cartQty})` : `<i class="fas fa-plus"></i> Add`;
        const btnClass = cartQty > 0 ? 'btn-add-cart added' : 'btn-add-cart';

        let badgeHTML = '';
        if (item.badge === 'best') badgeHTML = '<span class="menu-badge"><i class="fas fa-star"></i> Bestseller</span>';
        else if (item.badge === 'new') badgeHTML = '<span class="menu-badge new">New</span>';

        card.innerHTML = `
            <div class="menu-card-img-wrapper">
                ${badgeHTML}
                <img src="${item.image}" class="menu-card-img" alt="${item.name}" onerror="this.src='https://via.placeholder.com/400x300/1A1A22/FF5A00?text=Food'">
            </div>
            <div class="menu-card-body">
                <h3 class="menu-card-name">${item.name}</h3>
                <p class="menu-card-desc">${item.desc || ''}</p>
                <div class="menu-card-bottom">
                    <p class="menu-card-price">₹${item.price}</p>
                </div>
                <div class="menu-card-actions">
                    <button class="${btnClass}" id="addBtn-${item.id}" onclick="addToCart('${item.id}')">${btnText}</button>
                    <button class="btn-buy-now" onclick="openBuyNow('${item.id}')"><i class="fas fa-bolt"></i> Buy</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

// ===== CART FUNCTIONS =====
function addToCart(itemId) {
    const item = menuItems.find(i => i.id == itemId);
    if (!item) return;

    const existing = cart.find(c => c.id == itemId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: item.id, name: item.name, price: item.price, image: item.image, qty: 1 });
    }

    saveCartToStorage();
    updateCartUI();
    updateMenuButtons();
    showToast(`${item.name} added! 🍔`);
}

function updateMenuButtons() {
    menuItems.forEach(item => {
        const btn = document.getElementById(`addBtn-${item.id}`);
        if (!btn) return;

        const inCart = cart.find(c => c.id == item.id);
        if (inCart) {
            btn.innerHTML = `<i class="fas fa-check"></i> In Cart (${inCart.qty})`;
            btn.classList.add('added');
        } else {
            btn.innerHTML = `<i class="fas fa-plus"></i> Add`;
            btn.classList.remove('added');
        }
    });
}

function saveCartToStorage() { localStorage.setItem('stall_cart', JSON.stringify(cart)); }
function loadCartFromStorage() { const stored = localStorage.getItem('stall_cart'); if (stored) { try { cart = JSON.parse(stored); } catch (e) { cart = []; } } }
function toggleCart() { document.getElementById('cartSidebar').classList.toggle('show'); document.getElementById('cartOverlay').classList.toggle('show'); }

function updateCartUI() {
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const footerEl = document.getElementById('cartFooter');
    const totalEl = document.getElementById('cartTotal');
    const subtitleEl = document.getElementById('cartSubtitle');

    // Floating Bar
    const floatBar = document.getElementById('floatCartBar');
    const floatCount = document.getElementById('floatCount');
    const floatTotal = document.getElementById('floatTotal');
    const floatItemsText = document.getElementById('floatItemsText');

    let totalItems = 0;
    let totalPrice = 0;
    cart.forEach(item => {
        totalItems += item.qty;
        totalPrice += item.price * item.qty;
    });

    // Update header cart count
    if (countEl) {
        countEl.textContent = totalItems;
        countEl.classList.remove('bump');
        void countEl.offsetWidth;
        countEl.classList.add('bump');
    }
    if (subtitleEl) subtitleEl.textContent = `${totalItems} items`;

    // Floating bar visibility and data
    if (floatBar) {
        if (totalItems > 0) {
            floatBar.style.display = 'flex';
            if (floatCount) floatCount.textContent = totalItems;
            if (floatTotal) floatTotal.textContent = `₹${totalPrice}`;
            if (floatItemsText) floatItemsText.textContent = totalItems === 1 ? 'item added' : 'items added';
        } else {
            floatBar.style.display = 'none';
        }
    }

    if (cart.length === 0) {
        if (itemsEl) itemsEl.innerHTML = `<div class="empty-cart"><i class="fas fa-shopping-bag"></i><h3>Bag is empty</h3><p>Add something delicious 🔥</p></div>`;
        if (footerEl) footerEl.style.display = 'none';
        return;
    }

    if (footerEl) footerEl.style.display = 'block';

    let html = '';
    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/55/1A1A22/FF5A00?text=🍔'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price-each">₹${item.price} each</div>
                    <div class="cart-item-subtotal">₹${subtotal}</div>
                </div>
                <div class="cart-item-right">
                    <div class="qty-control">
                        <button onclick="updateCartQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                        <span>${item.qty}</span>
                        <button onclick="updateCartQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    });

    if (itemsEl) itemsEl.innerHTML = html;
    if (totalEl) totalEl.textContent = `₹${totalPrice}`;
}

function updateCartQty(itemId, delta) {
    const item = cart.find(c => c.id == itemId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(c => c.id != itemId);
    }
    saveCartToStorage();
    updateCartUI();
    updateMenuButtons();
}

function removeFromCart(itemId) {
    const item = cart.find(c => c.id == itemId);
    const itemName = item ? item.name : '';
    cart = cart.filter(c => c.id != itemId);
    saveCartToStorage();
    updateCartUI();
    updateMenuButtons();
    if (itemName) showToast(`${itemName} removed! 🗑️`);
}

// ===== PAYMENT SELECTION =====
function selectPayment(method) {
    selectedPayment = method;
    document.getElementById('btnCash').classList.toggle('active', method === 'cash');
    document.getElementById('btnUpi').classList.toggle('active', method === 'upi');
}

function selectModalPayment(method) {
    modalPayment = method;
    document.getElementById('modalBtnCash').classList.toggle('active', method === 'cash');
    document.getElementById('modalBtnUpi').classList.toggle('active', method === 'upi');
}

// ===== BUY NOW =====
function openBuyNow(itemId) {
    const item = menuItems.find(i => i.id == itemId);
    if (!item) return;

    currentBuyNowItem = item;
    modalQty = 1;
    modalPayment = 'cash';

    document.getElementById('modalItemImg').src = item.image;
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemPrice').textContent = `₹${item.price}`;
    document.getElementById('modalQty').textContent = '1';
    document.getElementById('modalTotal').textContent = `₹${item.price}`;

    document.getElementById('modalBtnCash').classList.add('active');
    document.getElementById('modalBtnUpi').classList.remove('active');

    document.getElementById('buyNowModal').style.display = 'flex';
}

function closeBuyNow() {
    document.getElementById('buyNowModal').style.display = 'none';
    // ⚠️ FIXED: Do NOT nullify currentBuyNowItem here
    // currentBuyNowItem will be cleared after data is read in buyNowOrder
}

function changeModalQty(delta) {
    modalQty += delta;
    if (modalQty < 1) modalQty = 1;
    if (modalQty > 20) modalQty = 20;

    document.getElementById('modalQty').textContent = modalQty;
    document.getElementById('modalTotal').textContent = `₹${currentBuyNowItem.price * modalQty}`;
}

// ⚠️ FIXED: Save data FIRST, then close modal
function buyNowOrder() {
    if (!currentBuyNowItem) {
        console.error("Buy Now error: No item selected.");
        return;
    }

    // Read data from currentBuyNowItem BEFORE calling closeBuyNow
    const itemId = currentBuyNowItem.id;
    const itemName = currentBuyNowItem.name;
    const itemPrice = currentBuyNowItem.price;
    const qty = modalQty;
    const total = itemPrice * qty;

    closeBuyNow(); // Now safe to close because we saved data above

    const orderItems = [{
        id: itemId,
        name: itemName,
        price: itemPrice,
        qty: qty
    }];

    // Store for next step
    pendingOrderData = {
        items: orderItems,
        total: total,
        payment: modalPayment
    };

    showNameModal();
}

// ===== NAME INPUT =====
function showNameModal() {
    const existing = document.getElementById('nameModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'nameModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center;">
            <h2 style="color:#FF5A00; margin-bottom:5px;"><i class="fas fa-user-circle"></i> Your Name?</h2>
            <p style="color:#A1A1AA; font-size:13px; margin-bottom:20px;">We'll call your name when your order is ready!</p>
            <input type="text" id="customerNameInput" placeholder="Enter your full name..." 
                   style="width:100%; padding:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:16px; text-align:center; margin-bottom:20px; outline:none;"
                   onfocus="this.style.borderColor='#FF5A00'">
            <button class="checkout-btn" onclick="submitNameAndProceed()">
                Proceed <i class="fas fa-arrow-right"></i>
            </button>
        </div>`;

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('customerNameInput').focus(), 300);
    document.getElementById('customerNameInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitNameAndProceed();
    });
}

function submitNameAndProceed() {
    const nameInput = document.getElementById('customerNameInput');
    const name = nameInput.value.trim();

    if (!name) {
        nameInput.style.borderColor = '#ff2d2d';
        nameInput.style.animation = 'shake 0.4s ease';
        setTimeout(() => { nameInput.style.animation = ''; }, 400);
        showToast('Please enter your name! ✏️');
        return;
    }

    const modal = document.getElementById('nameModal');
    if (modal) modal.remove();

    if (pendingOrderData.payment === 'upi') {
        initiateUPIPayment(pendingOrderData.total, name);
    } else {
        pushOrderToFirebase(pendingOrderData.items, pendingOrderData.total, 'cash', 'pending', name);
    }
}

// =====================================================
// 💸 UPI PAYMENT (CLAIMED STATUS FOR ADMIN)
// =====================================================
function initiateUPIPayment(amount, customerName) {
    const upiURL = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Order - ' + customerName)}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        showToast('Opening UPI App... 📱');
        window.location.href = upiURL;
        setTimeout(() => showUPIConfirmModal(amount, customerName), 2500);
    } else {
        showUPIQRModal(amount, customerName);
    }
}

function showUPIConfirmModal(amount, customerName) {
    const existing = document.getElementById('upiConfirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'upiConfirmModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center;">
            <div style="font-size:50px;">📱</div>
            <h2 style="color:#FF5A00; margin-bottom:8px;">Did you pay?</h2>
            <p style="color:#FACC15; font-size:24px; font-weight:800; margin-bottom:20px;">₹${amount}</p>
            <div style="display:flex; gap:10px;">
                <button class="checkout-btn" style="background:#22C55E; box-shadow:none;" onclick="confirmUPIPayment('${customerName}')"><i class="fas fa-check"></i> Paid</button>
                <button class="checkout-btn" style="background:#EF4444; box-shadow:none;" onclick="cancelUPIPayment()"><i class="fas fa-times"></i> Cancel</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function confirmUPIPayment(customerName) {
    document.getElementById('upiConfirmModal').remove();
    pushOrderToFirebase(pendingOrderData.items, pendingOrderData.total, 'upi', 'claimed_paid', customerName);
}

function cancelUPIPayment() {
    document.getElementById('upiConfirmModal').remove();
    showToast('Cancelled ❌');
    pendingOrderData = null;
}

function showUPIQRModal(amount, customerName) {
    const existing = document.getElementById('upiQRDesktopModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'upiQRDesktopModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center;">
            <button class="modal-close" onclick="closeDesktopQR()"><i class="fas fa-xmark"></i></button>
            <h2 style="margin-bottom:15px;"><i class="fas fa-qrcode"></i> Scan & Pay</h2>
            <div style="background:#fff; padding:15px; border-radius:16px; display:inline-block; margin-bottom:15px;"><img src="${QR_IMAGE}" alt="QR" style="width:180px;height:180px;object-fit:contain;"></div>
            <p style="font-size:24px; font-weight:800; color:#FACC15; margin-bottom:15px;">₹${amount}</p>
            <button class="checkout-btn" onclick="confirmDesktopQR('${customerName}')"><i class="fas fa-check"></i> I've Paid</button>
        </div>`;
    document.body.appendChild(modal);
}

function closeDesktopQR() {
    const modal = document.getElementById('upiQRDesktopModal');
    if (modal) modal.remove();
    pendingOrderData = null;
}

function confirmDesktopQR(customerName) {
    document.getElementById('upiQRDesktopModal').remove();
    pushOrderToFirebase(pendingOrderData.items, pendingOrderData.total, 'upi', 'claimed_paid', customerName);
}

// =====================================================
// 🚀 PUSH ORDER TO FIREBASE
// =====================================================
function pushOrderToFirebase(items, total, paymentMethod, paymentStatus, customerName) {
    const orderId = Math.floor(1000 + Math.random() * 9000);
    const orderData = {
        id: orderId,
        customerName: customerName,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        total: total,
        payment: paymentMethod,
        paymentStatus: paymentStatus,
        status: 'received',
        timestamp: Date.now()
    };

    db.ref('orders/' + orderId).set(orderData).then(() => {
        cart = [];
        saveCartToStorage();
        updateCartUI();
        updateMenuButtons();

        document.getElementById('cartSidebar').classList.remove('show');
        document.getElementById('cartOverlay').classList.remove('show');

        currentOrderId = orderId;
        localStorage.setItem('stall_my_order', orderId.toString());
        pendingOrderData = null;

        showSuccessModal(orderId, paymentMethod, paymentStatus, customerName);
        listenToOrderStatus(orderId);
    }).catch((err) => {
        console.error("Firebase error:", err);
        alert('Order failed to send. Please check your connection.');
    });
}

function showSuccessModal(orderId, paymentMethod, paymentStatus, customerName) {
    document.getElementById('successOrderId').textContent = orderId;

    const payInfo = document.getElementById('paymentInfo');
    const nameLine = `<p style="margin-bottom:5px;"><i class="fas fa-user" style="color:#FF5A00;"></i> <strong>${customerName}</strong></p>`;

    if (paymentMethod === 'upi') {
        payInfo.innerHTML = nameLine + `<p><i class="fas fa-clock" style="color:#FACC15;"></i> <strong>Verifying Payment... ⏳</strong></p>`;
    } else {
        payInfo.innerHTML = nameLine + `<p><i class="fas fa-money-bill-wave" style="color:#22C55E;"></i> Pay <strong>Cash</strong> at counter 💵</p>`;
    }

    document.getElementById('orderSuccessModal').style.display = 'flex';
}

function closeSuccessModal() {
    document.getElementById('orderSuccessModal').style.display = 'none';
    showStatusTracker();
}

function showStatusTracker() {
    if (!currentOrderId) return;
    db.ref('orders/' + currentOrderId).on('value', (snapshot) => {
        const order = snapshot.val();
        if (!order) return;
        document.getElementById('trackOrderId').textContent = currentOrderId;
        const itemsList = order.items.map(i => `${i.name} × ${i.qty}`).join(' | ');
        let paymentText = '';
        if (order.payment === 'upi') {
            if (order.paymentStatus === 'verified') paymentText = '<span style="color:#22C55E;">📱 UPI Verified ✅</span>';
            else paymentText = '<span style="color:#FACC15;">⏳ Verifying...</span>';
        } else {
            paymentText = '💵 Cash (Pay at counter)';
        }
        document.getElementById('statusItems').innerHTML = `
            <p>👤 <strong>${order.customerName}</strong></p>
            <p>📦 ${itemsList}</p>
            <p style="margin-top:5px; font-weight:700;">Total: ₹${order.total} | ${paymentText}</p>`;
        updateStatusSteps(order.status);
        document.getElementById('statusTracker').style.display = 'block';
    });
}

function listenToOrderStatus(orderId) {
    db.ref('orders/' + orderId).on('value', (snapshot) => {
        const order = snapshot.val();
        if (order) {
            updateStatusSteps(order.status);
            if (order.status === 'ready' && navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    });
}

function updateStatusSteps(status) {
    const steps = ['received', 'preparing', 'ready'];
    const stepEls = {
        received: document.getElementById('step-received'),
        preparing: document.getElementById('step-preparing'),
        ready: document.getElementById('step-ready')
    };
    const lines = {
        0: document.getElementById('line1'),
        1: document.getElementById('line2')
    };
    const currentIndex = steps.indexOf(status);
    if (currentIndex === -1) return;

    for (let key in stepEls) {
        if (stepEls[key]) stepEls[key].classList.remove('active');
    }
    for (let key in lines) {
        if (lines[key]) lines[key].classList.remove('active');
    }

    for (let i = 0; i <= currentIndex; i++) {
        if (stepEls[steps[i]]) stepEls[steps[i]].classList.add('active');
        if (i > 0 && lines[i - 1]) lines[i - 1].classList.add('active');
    }
}

function closeStatus() {
    document.getElementById('statusTracker').style.display = 'none';
}

function checkExistingOrder() {
    const savedOrderId = localStorage.getItem('stall_my_order');
    if (savedOrderId) {
        currentOrderId = parseInt(savedOrderId);
        listenToOrderStatus(currentOrderId);
        showStatusTracker();
    }
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
    }, 2500);
}