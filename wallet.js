const PAYSTACK_KEY = "pk_live_cd8547f6b4270551729c247d8d31635691c39a08";

function getWallet() {
  const user = localStorage.getItem("loggedInUser");
  if(!user) return {approved:0,pending:0,txs:[]};
  return JSON.parse(localStorage.getItem("wallet_"+user)) || {approved:0,pending:0,txs:[]};
}

function saveWallet(wallet) {
  const user = localStorage.getItem("loggedInUser");
  if(!user) return;
  localStorage.setItem("wallet_"+user, JSON.stringify(wallet));
  renderWallet();
}

function renderWallet(){
  const wallet = getWallet();
  const approvedEl = document.getElementById("walletApproved");
  const txList = document.getElementById("txList");
  if(approvedEl) approvedEl.innerText = wallet.approved.toLocaleString();
  if(txList){
    if(wallet.txs.length === 0) txList.innerHTML="<p>No transactions yet</p>";
    else{
      txList.innerHTML="";
      wallet.txs.forEach(tx=>{
        const div = document.createElement("div");
        div.innerHTML = `<strong>${tx.type}</strong> ₦${tx.amount.toLocaleString()}<br><small>${tx.ref}</small><br><span>${tx.status}</span>`;
        txList.appendChild(div);
      });
    }
  }
}

function deposit(){
  const amount = Number(document.getElementById("depositAmount").value);
  if(!amount || amount < 100) return alert("Minimum deposit ₦100");
  const ref = "LS-"+Date.now();
  const email = localStorage.getItem("loggedInUser")+"@lomashares.com";
  const handler = PaystackPop.setup({
    key: PAYSTACK_KEY,
    email: email,
    amount: amount*100,
    currency: "NGN",
    ref: ref,
    callback: function(response){
      const wallet = getWallet();
      wallet.approved += amount;
      wallet.txs.unshift({type:"Deposit",amount:amount,ref:ref,status:"Success"});
      saveWallet(wallet);
      alert("Deposit successful!");
    },
    onClose: function(){ alert("Payment cancelled"); }
  });
  handler.openIframe();
}

function withdraw(){
  const amount = Number(document.getElementById("withdrawAmount").value);
  const wallet = getWallet();
  if(!amount || amount < 1000) return alert("Minimum withdrawal ₦1000");
  if(amount > wallet.approved) return alert("Insufficient balance");
  wallet.approved -= amount;
  wallet.txs.unshift({type:"Withdrawal",amount:amount,ref:"WD-"+Date.now(),status:"Success"});
  saveWallet(wallet);
  alert("Withdrawal requested and sent!");
}

document.addEventListener("DOMContentLoaded", renderWallet);
