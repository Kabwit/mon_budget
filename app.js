let db;
const DB_NAME = 'BudgetRDC_VFinal_Perfect';
const STORE_NAME = 'txs';
let userRate = 2800, userSalary = 0, myChart;
let editingId = null; // Pour savoir si on modifie une transaction

const RULES = {
    'Loyer': 'Needs', 'Alimentation': 'Needs', 'Transport': 'Needs', 'Santé': 'Needs', 'Eau/Elec': 'Needs',
    'Loisirs': 'Wants', 'Shopping': 'Wants', 'Restaurant': 'Wants', 'Internet': 'Wants',
    'Epargne': 'Savings', 'Investissement': 'Savings', 'Dette': 'Savings'
};

window.onload = () => {
    userRate = parseFloat(localStorage.getItem('rate')) || 2800;
    userSalary = parseFloat(localStorage.getItem('salary')) || 0;
    document.getElementById('input-rate').value = userRate;
    document.getElementById('input-salary').value = userSalary;
    document.getElementById('date').valueAsDate = new Date();
    updateCats('Dépense');
    initAuth();
};

// --- LOGIQUE DE CONNEXION (CORRIGÉE) ---
function initAuth() {
    const name = localStorage.getItem('user_name');
    if (!name) {
        document.getElementById('onboarding-screen').classList.remove('hidden');
    } else {
        document.getElementById('onboarding-screen').classList.add('hidden');
        ['main-header', 'main-nav'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        document.getElementById('welcome-user').textContent = `Bonjour, ${name} !`;
        document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
        openDB();
    }
}

// CETTE PARTIE MANQUAIT DANS TON CODE :
document.getElementById('onboarding-form').onsubmit = (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('user-name-input').value.trim();
    if (nameInput) {
        localStorage.setItem('user_name', nameInput);
        initAuth(); // Relance la vérification pour afficher l'app
    }
};

function openDB() {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = (e) => { db = e.target.result; loadAll(); };
}

// --- GESTION DE LA BASCULE ---
const btnDepense = document.getElementById('btn-depense');
const btnRevenu = document.getElementById('btn-revenu');
const typeInput = document.getElementById('transaction-type');

btnDepense.onclick = () => {
    typeInput.value = 'Dépense';
    updateCats('Dépense');
    btnDepense.classList.add('bg-white', 'text-red-600', 'shadow-sm');
    btnDepense.classList.remove('text-gray-400');
    btnRevenu.classList.remove('bg-white', 'text-emerald-600', 'shadow-sm');
    btnRevenu.classList.add('text-gray-400');
};

btnRevenu.onclick = () => {
    typeInput.value = 'Revenu';
    updateCats('Revenu');
    btnRevenu.classList.add('bg-white', 'text-emerald-600', 'shadow-sm');
    btnRevenu.classList.remove('text-gray-400');
    btnDepense.classList.remove('bg-white', 'text-red-600', 'shadow-sm');
    btnDepense.classList.add('text-gray-400');
};

function updateCats(type) {
    const list = type === 'Revenu' ? ['Salaire', 'Business', 'Cadeau', 'Autres'] : Object.keys(RULES);
    const select = document.getElementById('category');
    select.innerHTML = '<option value="" disabled selected>Choisir une catégorie...</option>';
    list.forEach(c => select.innerHTML += `<option value="${c}">${c}</option>`);
}

// --- CHARGEMENT & CALCULS ---
function loadAll() {
    const list = document.getElementById('transactions-list');
    list.innerHTML = '';
    let usd = 0, cdf = 0, all = [];
    let spent = { Needs: 0, Wants: 0, Savings: 0 };
    const month = new Date().toISOString().substring(0, 7);

    db.transaction(STORE_NAME).objectStore(STORE_NAME).openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const t = cursor.value;
            all.push(t);
            if (t.currency === 'USD') usd += t.amount; else cdf += t.amount;
            if (t.date.startsWith(month) && t.amount < 0) {
                const type = RULES[t.category] || 'Wants';
                spent[type] += t.currency === 'USD' ? Math.abs(t.amount) : Math.abs(t.amount / userRate);
            }
            render(t);
            cursor.continue();
        } else {
            updateUI(usd, cdf, spent);
            drawChart(all);
        }
    };
}

function updateUI(u, c, s) {
    const totalUSD = u + (c / userRate);
    document.getElementById('current-balance').innerHTML = `
        <h2 class="text-5xl font-black leading-tight">$ ${totalUSD.toLocaleString('fr-FR', {minimumFractionDigits:2})}</h2>
        <p class="text-indigo-200 text-[10px] font-bold mt-1 tracking-widest">≈ ${(totalUSD * userRate).toLocaleString('fr-FR')} FC</p>
    `;
    const rateText = `1$ = ${userRate} FC`;
    document.getElementById('display-rate').textContent = `Taux: ${rateText}`;
    document.getElementById('display-rate-header').textContent = rateText;

    const targets = { Needs: userSalary * 0.5, Wants: userSalary * 0.3, Savings: userSalary * 0.2 };
    ['Needs', 'Wants', 'Savings'].forEach(k => {
        const rem = targets[k] - s[k];
        document.getElementById(`${k.toLowerCase()}-status`).innerHTML = `
            <p class="text-sm font-black ${rem < 0 ? 'text-red-500' : 'text-indigo-700'}">$ ${rem.toFixed(0)}</p>
            <p class="text-[9px] font-bold text-gray-400">${(rem * userRate).toLocaleString('fr-FR')} FC</p>
        `;
    });
}

// --- RENDU AVEC BOUTONS SUPPRIMER/MODIFIER ---
function render(t) {
    const isNeg = t.amount < 0;
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-gray-50";
    div.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center ${isNeg?'bg-red-50 text-red-500':'bg-emerald-50 text-emerald-600'}">
                <i class="fas ${isNeg?'fa-minus':'fa-plus'} text-[10px]"></i>
            </div>
            <div>
                <p class="font-bold text-gray-800 text-[11px]">${t.description}</p>
                <p class="text-[8px] text-gray-400 uppercase font-black">${t.category}</p>
            </div>
        </div>
        <div class="flex items-center space-x-3">
            <div class="text-right">
                <p class="font-black ${isNeg?'text-red-500':'text-emerald-600'} text-[11px]">${t.currency==='USD'?'$':''} ${Math.abs(t.amount).toLocaleString('fr-FR')} ${t.currency==='CDF'?'FC':''}</p>
            </div>
            <button onclick="deleteTx(${t.id})" class="text-gray-300 hover:text-red-500"><i class="fas fa-trash-alt text-xs"></i></button>
        </div>
    `;
    document.getElementById('transactions-list').prepend(div);
}

// --- FONCTION SUPPRIMER ---
function deleteTx(id) {
    if(confirm("Supprimer cette opération ?")) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => loadAll();
    }
}

function showPage(id, btn) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.replace('text-indigo-600', 'text-gray-400'));
    if(btn && btn.tagName === "BUTTON") btn.classList.replace('text-gray-400', 'text-indigo-600');
}

// --- ACTIONS FORMULAIRE ---
document.getElementById('transaction-form').onsubmit = (e) => {
    e.preventDefault();
    const t = { 
        date: document.getElementById('date').value, 
        description: document.getElementById('description').value,
        amount: (typeInput.value === 'Dépense' ? -1 : 1) * parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value, 
        currency: document.getElementById('currency').value 
    };
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(t);
    tx.oncomplete = () => { 
        document.getElementById('transaction-form').reset(); 
        btnDepense.click(); 
        showPage('page-dashboard'); 
        loadAll(); 
    };
};

document.getElementById('save-rate').onclick = () => { 
    userRate = parseFloat(document.getElementById('input-rate').value) || 2800; 
    localStorage.setItem('rate', userRate); 
    loadAll(); 
    alert("Taux mis à jour !"); 
};

document.getElementById('save-salary').onclick = () => { 
    userSalary = parseFloat(document.getElementById('input-salary').value) || 0; 
    localStorage.setItem('salary', userSalary); 
    loadAll(); 
    alert("Revenu enregistré !"); 
};

function exportData() {
    db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll().onsuccess = (e) => {
        const data = e.target.result;
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget_export_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    };
}

function logout() { if(confirm("Supprimer les données et le profil ?")) { localStorage.clear(); location.reload(); } }

function drawChart(txs) {
    const data = {};
    txs.filter(t => t.amount < 0).forEach(t => { 
        const v = t.currency === 'USD' ? Math.abs(t.amount) : Math.abs(t.amount / userRate); 
        data[t.category] = (data[t.category] || 0) + v; 
    });
    if(myChart) myChart.destroy();
    if(Object.keys(data).length > 0) {
        myChart = new Chart(document.getElementById('budgetChart'), { 
            type: 'doughnut', 
            data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#4f46e5', '#a855f7', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] }, 
            options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } }, cutout: '75%' } 
        });
    }
}
