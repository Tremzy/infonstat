document.addEventListener("DOMContentLoaded", () => {
    const navbarlist = document.getElementById("nbl");
    let navitems = navbarlist.querySelectorAll(".navlink");

    if (window.location.href.split("/").at(-1).replaceAll("#", "") == "") {
        history.pushState({ ref:"index.html" }, "", "index.html");
    }


    navitems.forEach(item => {
        if (item.getAttribute("href") === window.location.href.split("/").slice(-2).join("/")) {
            item.setAttribute("aria-current", "page");
            item.classList.add("active");
        }
        item.addEventListener("click", event => {
            event.preventDefault();
            console.log(item.getAttribute("href"))
            routePage(item.getAttribute("href"));
        });
    });

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.ref) {
            routePage(event.state.ref, false);
        }
    });
});

function routePage(ref, pushHistory = true) {
    console.log(`Routing to: ${ref}`);
    fetch(ref)
        .then(res => {
            if (!res.ok) throw new Error("Page not found or inaccessible");
            return res.text();
        })
    .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let remoteHtml = doc.getElementById("app").innerHTML;
        document.getElementById("app").innerHTML = remoteHtml;
        fetch("./pages.json")
        .then(res => res.json())
        .then(jsonData => {
            document.getElementById("app").setAttribute("data-page", jsonData[ref]);
            const currentPage = document.getElementById("app")?.dataset?.page;
            console.log(currentPage)
            if (currentPage === "performance") {
                setTimeout(() => {
                    if (typeof window.updateChart === "function") {
                        window.updateChart();
                    }
                }, 100);
            }
            else if (currentPage === "log") {
                if (typeof window.updateLogSelector === "function") {
                    window.updateLogSelector();
                }
            }
            else if (currentPage === "settings") {
                console.log("settingspage")
                if (typeof window.fetchSettings === "function") {
                    window.fetchSettings();
                    console.log("function called")
                }
            }
        })

        if (pushHistory) {
            history.pushState({ ref:ref }, "", ref);
        }

        updateActiveNavbar(ref);
    })
    .catch(err => {
        console.error(err);
        document.getElementById("app").innerHTML = "<h1>404 - Page not found</h1>";
        //alert("Page not found");
    });
}

function updateActiveNavbar(ref) {
    const navbarlist = document.getElementById("nbl");
    let navitems = navbarlist.querySelectorAll(".navlink");

    navitems.forEach(item => {
        item.classList.remove("active");
        item.removeAttribute("aria-current");
        
        if (item.getAttribute("href") === window.location.href.split("/").slice(-2).join("/")) {
            item.setAttribute("aria-current", "page");
            item.classList.add("active");
        }
    });
}
