function invest(){
  const amount = Number(document.getElementById("investAmount").value);
  if(!amount || amount < 1000) return alert("Minimum investment ₦1000");
  const wallet = getWallet();
  if(amount > wallet.approved) return alert("Insufficient balance");
  wallet.approved -= amount;
  wallet.txs.unshift({type:"Investment",amount:amount,ref:"INV-"+Date.now(),status:"Ongoing"});
  saveWallet(wallet);
  alert("Investment successful! ROI will add automatically after maturity.");
}
