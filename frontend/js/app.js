const API_BASE = 'http://localhost:3000/api';
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
let searchTimeout;
let currentFilter = 'all'; // 'all', 'featured', or 'category'
let isNavigating = false; // Prevent infinite recursion

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadProducts();
    updateCartCount();
    updateWishlistUI();
});

// Authentication functions
async function register(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateAuthUI();
            showSection('products');
            showToast('Registration successful!');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('Registration failed', 'error');
    }
}

async function login(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateAuthUI();
            showSection('products');
            showToast('Login successful!');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('Login failed', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthUI();
    showSection('products');
    showToast('Logged out successfully');
}

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        // In a real app, verify token with server
        currentUser = { username: 'User' };
        updateAuthUI();
    }
}

function updateAuthUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const usernameSpan = document.getElementById('username');

    if (currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        usernameSpan.textContent = currentUser.username;
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}

// Product functions
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        products = await response.json();
        // Don't call showAllProducts() here to avoid recursion
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error loading products', 'error');
    }
}

// New function to show all products
function showAllProducts() {
    if (isNavigating) return;
    isNavigating = true;
    
    currentFilter = 'all';
    showSection('products');
    document.getElementById('products-title').textContent = 'Our Products';
    document.getElementById('category-filter').value = '';
    document.getElementById('show-all-btn').style.display = 'none';
    displayProducts(products);
    
    setTimeout(() => { isNavigating = false; }, 100);
}

// New function to show featured products using backend API
async function showFeaturedProducts() {
    if (isNavigating) return;
    isNavigating = true;
    
    currentFilter = 'featured';
    showSection('products');
    
    try {
        const response = await fetch(`${API_BASE}/products/featured`);
        const featuredProducts = await response.json();
        
        document.getElementById('products-title').textContent = 'Featured Products';
        document.getElementById('category-filter').value = '';
        document.getElementById('show-all-btn').style.display = 'inline-block';
        displayProducts(featuredProducts);
    } catch (error) {
        console.error('Error loading featured products:', error);
        showToast('Error loading featured products', 'error');
        // Fallback: manually filter featured products
        const featuredIds = [1, 2, 4]; // Same IDs as backend
        const featuredProducts = products.filter(product => featuredIds.includes(product.id));
        document.getElementById('products-title').textContent = 'Featured Products';
        document.getElementById('show-all-btn').style.display = 'inline-block';
        displayProducts(featuredProducts);
    }
    
    setTimeout(() => { isNavigating = false; }, 100);
}

function displayProducts(productsToDisplay) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (productsToDisplay.length === 0) {
        let message = 'No products found';
        if (currentFilter === 'featured') {
            message = 'No featured products available';
        } else if (currentFilter === 'category') {
            const category = document.getElementById('category-filter').value;
            message = `No products found in ${category} category`;
        }
        
        grid.innerHTML = `
            <div class="empty-state">
                <h3>${message}</h3>
                <p>Try adjusting your search or filters</p>
                ${currentFilter !== 'all' ? '<button class="btn btn-primary" onclick="showAllProducts()">Show All Products</button>' : ''}
            </div>
        `;
        return;
    }

    productsToDisplay.forEach(product => {
        const isInWishlist = wishlist.includes(product.id);
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        // Check if product is featured (you can customize this logic)
        const isFeatured = [1, 2, 4].includes(product.id); // Same IDs as backend
        
        productCard.innerHTML = `
            <div class="product-card-badge">${product.category}</div>
            ${isFeatured && currentFilter === 'featured' ? '<div class="product-card-badge" style="left: auto; right: 1rem; background: var(--accent);">🔥 Featured</div>' : ''}
            <button class="wishlist-btn" onclick="toggleWishlist(${product.id})" data-product-id="${product.id}">
                ${isInWishlist ? '❤️' : '🤍'}
            </button>
            <img src="http://localhost:3000${product.image_url}" 
                 alt="${product.name}" 
                 class="product-card-image"
                 onerror="this.src='https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop&auto=format'">
            <div class="product-card-content">
                <h3 class="product-card-title">${product.name}</h3>
                <p class="product-card-description">${product.description}</p>
                <div class="product-card-price">$${product.price}</div>
                <div class="product-card-actions">
                    <button class="btn btn-primary" onclick="addToCart(${product.id})">
                        🛒 Add to Cart
                    </button>
                    <button class="btn btn-secondary" onclick="showProductDetails(${product.id})">
                        View Details
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(productCard);
    });
}

function filterProducts() {
    const category = document.getElementById('category-filter').value;
    
    if (category) {
        currentFilter = 'category';
        const filteredProducts = products.filter(product => product.category === category);
        document.getElementById('products-title').textContent = `${category} Products`;
        document.getElementById('show-all-btn').style.display = 'inline-block';
        displayProducts(filteredProducts);
    } else {
        // If no category selected, return to current filter state
        if (currentFilter === 'featured') {
            showFeaturedProducts();
        } else {
            showAllProducts();
        }
    }
}

async function showProductDetails(productId) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`);
        const product = await response.json();
        
        const detailsContent = document.getElementById('product-details-content');
        if (!detailsContent) return;
        
        detailsContent.innerHTML = `
            <button class="btn btn-secondary" onclick="showSection('products')">
                ← Back to Products
            </button>
            <div class="product-detail">
                <div>
                    <img src="http://localhost:3000${product.image_url}" 
                         alt="${product.name}" 
                         class="product-detail-image"
                         onerror="this.src='https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop&auto=format'">
                </div>
                <div class="product-detail-content">
                    <h2 class="product-detail-title">${product.name}</h2>
                    <p class="product-detail-price">$${product.price}</p>
                    <p class="product-detail-description">${product.description}</p>
                    <div class="product-meta">
                        <div class="meta-item">
                            <span class="meta-label">Category</span>
                            <span class="meta-value">${product.category}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Stock</span>
                            <span class="meta-value">${product.stock} available</span>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="addToCart(${product.id})" 
                            style="padding: 1rem 2rem; font-size: 1.1rem;">
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
        showSection('product-details');
        loadProductReviews(productId);
    } catch (error) {
        console.error('Error loading product details:', error);
        showToast('Error loading product details', 'error');
    }
}

// Search functionality
function handleSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (query.length < 2) {
            // Return to current filter state when search is cleared
            if (currentFilter === 'featured') {
                showFeaturedProducts();
            } else {
                showAllProducts();
            }
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/products/search/${encodeURIComponent(query)}`);
            const results = await response.json();
            document.getElementById('products-title').textContent = `Search Results for "${query}"`;
            document.getElementById('show-all-btn').style.display = 'inline-block';
            displayProducts(results);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('Search failed', 'error');
        }
    }, 300);
}

// Cart functions
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showToast('Product not found', 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: 1
        });
    }

    updateCart();
    
    // Add animation to cart icon
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.style.transform = 'scale(1.5)';
        setTimeout(() => cartCount.style.transform = 'scale(1)', 300);
    }
    
    showToast('Product added to cart!');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showToast('Product removed from cart');
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCart();
        }
    }
}

function updateCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    displayCartItems();
}

function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const count = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = count;
    }
}

function displayCartItems() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    
    if (!cartItems || !cartTotal) return;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
        cartTotal.textContent = '0.00';
        return;
    }

    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <img src="http://localhost:3000${item.image_url}" 
                 alt="${item.name}" 
                 class="cart-item-image"
                 onerror="this.src='https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop&auto=format'">
            <div class="cart-item-details">
                <h4 class="cart-item-title">${item.name}</h4>
                <p class="cart-item-price">$${item.price} x ${item.quantity} = $${itemTotal.toFixed(2)}</p>
            </div>
            <div class="cart-item-controls">
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });

    cartTotal.textContent = total.toFixed(2);
}

async function checkout() {
    if (!currentUser) {
        showToast('Please login to checkout', 'error');
        showSection('login');
        return;
    }

    if (cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }

    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart,
                totalAmount: totalAmount
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('Order placed successfully!');
            cart = [];
            updateCart();
            showSection('products');
        } else {
            showToast('Checkout failed: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Checkout failed', 'error');
    }
}

async function loadOrders() {
    if (!currentUser) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const orders = await response.json();
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Error loading orders', 'error');
    }
}

function displayOrders(orders) {
    const ordersList = document.getElementById('orders-list');
    if (!ordersList) return;
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<div class="empty-state"><p>No orders found</p></div>';
        return;
    }

    ordersList.innerHTML = orders.map(order => `
        <div class="order-item">
            <h4>Order #${order.id}</h4>
            <p>Status: ${order.status}</p>
            <p>Total: $${order.total_amount}</p>
            <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
        </div>
    `).join('');
}

// Wishlist functionality
function toggleWishlist(productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist');
    } else {
        wishlist.push(productId);
        showToast('Added to wishlist!');
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
}

function updateWishlistUI() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const productId = parseInt(btn.dataset.productId);
        btn.textContent = wishlist.includes(productId) ? '❤️' : '🤍';
    });
}

// Product reviews
async function loadProductReviews(productId) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}/reviews`);
        const reviews = await response.json();
        displayProductReviews(reviews);
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function displayProductReviews(reviews) {
    const reviewsContainer = document.getElementById('product-reviews');
    if (!reviewsContainer) return;
    
    if (reviews.length === 0) {
        reviewsContainer.innerHTML = '<div class="empty-state"><p>No reviews yet. Be the first to review!</p></div>';
        return;
    }
    
    reviewsContainer.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <span class="review-author">${review.username}</span>
                <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
            </div>
            <p>${review.comment}</p>
            <small>${new Date(review.created_at).toLocaleDateString()}</small>
        </div>
    `).join('');
}

// Toast notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <strong>${type === 'success' ? '✅' : '❌'} ${message}</strong>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation - FIXED to prevent recursion
function showSection(sectionName) {
    // Prevent infinite recursion
    if (isNavigating) return;

     // Close mobile menu
    closeMobileMenu();
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Load section-specific data
    if (sectionName === 'cart') {
        displayCartItems();
    } else if (sectionName === 'orders') {
        loadOrders();
    }
    // Don't call showAllProducts() or showFeaturedProducts() here
}

// Mobile menu functionality
function toggleMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Close mobile menu when clicking on a link
function closeMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    if (navLinks) {
        navLinks.classList.remove('active');
    }
}

// Make functions globally available
window.showAllProducts = showAllProducts;
window.showFeaturedProducts = showFeaturedProducts;
window.showSection = showSection;
window.login = login;
window.register = register;
window.logout = logout;
window.handleSearch = handleSearch;
window.filterProducts = filterProducts;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.checkout = checkout;
window.showProductDetails = showProductDetails;
window.toggleWishlist = toggleWishlist;