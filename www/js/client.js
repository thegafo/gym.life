

var app = new Vue({
  el: "#app",
	data: {
			online: false,
			loginusername: "",
			loginpassword: "",
	},
	methods: {
			login: function(e) {
				e.preventDefault();
				alert("Trying to log in " + app.loginusername + " " + app.loginpassword);
			}
	}
});
