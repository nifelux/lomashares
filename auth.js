async function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
  } else {
    window.location.href = "index.html";
  }
}

async function register() {
  const email = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    alert(error.message);
  } else {
    alert("Registration successful. You can login now.");
    window.location.href = "login.html";
  }
    }
