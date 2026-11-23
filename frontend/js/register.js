document.getElementById("registerForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const message = document.getElementById("message");

    if (!name || !email || !password) {
        message.innerHTML = `
            <div class="alert alert-danger">
                Please complete all fields.
            </div>
        `;document
    .getElementById("registerForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();


        const name =
            document.getElementById("name").value.trim();


        const email =
            document.getElementById("email").value.trim();


        const password =
            document.getElementById("password").value;


        const message =
            document.getElementById("message");



        if (!name || !email || !password) {

            message.innerHTML = `

                <div class="alert alert-danger">

                    Please complete all fields.

                </div>

            `;

            return;

        }



        if (password.length < 6) {

            message.innerHTML = `

                <div class="alert alert-danger">

                    Password must be at least 6 characters.

                </div>

            `;

            return;

        }



        try {

            const response = await fetch(
                `${API_URL}/auth/register`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        name: name,
                        email: email,
                        password: password

                    })

                }
            );



            const data = await response.json();



            if (response.ok) {

                message.innerHTML = `

                    <div class="alert alert-success">

                        Registration successful!

                    </div>

                `;


                document
                    .getElementById("registerForm")
                    .reset();


            } else {

                message.innerHTML = `

                    <div class="alert alert-danger">

                        ${data.message || "Registration failed."}

                    </div>

                `;

            }


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            message.innerHTML = `

                <div class="alert alert-danger">

                    Unable to connect to the server.
                    Make sure the backend is running.

                </div>

            `;

        }

    });
        return;
    }

    if (password.length < 6) {
        message.innerHTML = `
            <div class="alert alert-danger">
                Password must be at least 6 characters.
            </div>
        `;
        return;
    }

    try {

        const response = await fetch(http://localhost:5000/api/users`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {

            message.innerHTML = `
                <div class="alert alert-success">
                    Registration successful!
                </div>
            `;

            document.getElementById("registerForm").reset();

        } else {

            message.innerHTML = `
                <div class="alert alert-danger">
                    ${data.message || "Registration failed."}
                </div>
            `;
        }

    } catch (error) {

        console.error("Registration error:", error);

        message.innerHTML = `
            <div class="alert alert-danger">
                Unable to connect to the server.
            </div>
        `;
    }

});