function login(){
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const user = JSON.parse(localStorage.getItem("user_"+username));
  if(user && user.password === password){
    localStorage.setItem("loggedInUser", username);
    window.location.href="index.html";
  } else alert("Invalid username or password");
}

function register(){
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;
  if(!username || !password) return alert("Fill all fields");
  if(localStorage.getItem("user_"+username)) return alert("User exists");
  localStorage.setItem("user_"+username, JSON.stringify({username,password}));
  alert("Registered! Login now.");
  window.location.href="login.html";
}

document.addEventListener("DOMContentLoaded", ()=>{
  const logged = localStorage.getItem("loggedInUser");
  if(logged && (window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("register.html"))){
    window.location.href="index.html";
  }
  const userDisplay = document.getElementById("userDisplay");
  if(userDisplay) userDisplay.innerText = logged || "";
});
