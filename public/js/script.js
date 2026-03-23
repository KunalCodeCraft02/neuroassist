let tl = gsap.timeline();


tl.from(".hero-text h1",
    {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power2.out"

    }, "same")


tl.from("nav ul a", {
    y: 20,
    stagger: 0.2,
    opacity: 0,
    duration: 0.5,
    ease: "power2.out"
}, "same")


tl.from("nav button", {
    //  y:20,
    // stagger: 0.2,
    opacity: 0,
    duration: 2,
    ease: "power2.out"
}, "same")


tl.from(".hero-text button", {
    y: 20,
    opacity: 0,
    duration: 1,
    ease: "power2.out"
}, "same")



function MainLoadingAnimation() {
    gsap.from("#page1 h1", {
        y: 30,
        opacity: 0,
        duration: 0.3,
        delay: 0.7,
        stagger: 0.2,
    });

    gsap.from("#page1 #videoContainer", {
        scale: 0.9,
        opacity: 0,
        duration: 0.4,
        delay: 1,
    });
}



function menu() {
    const menuicon = document.getElementById("menuicon");
    const fixediv = document.getElementById("fixediv");
    const logo = document.querySelector(".logo");
    const icons = document.querySelector("#icon");
    const nav = document.querySelector("#nav");
    const fixedivlinks = document.querySelectorAll("#fixediv a");

    let flag = 0;

    // console.log(fixediv);


    menuicon.addEventListener("click", function () {

        if (flag == 0) {
            gsap.to(fixediv, {
                top: "0%",
                duration: 0.5,
                ease: "power2.out"
            });
            gsap.from(fixedivlinks, {
                opacity: 0,
                y: 80,
                filter: "blur(10px)",
                duration: 1,
                stagger: 0.15,
                ease: "power3.out"
            })
            // nav.style.zIndex = 1000;
            logo.style.color = "white";
            icons.style.color = "white";
            flag = 1;
        }
        else {
            gsap.to(fixediv, {
                top: "-150%",
                duration: 0.5,
                ease: "power2.out"
            });
            // nav.style.zIndex = 1000;
            logo.style.color = "black";
            icons.style.color = "black";
            flag = 0;
        }
    })
}


const userIds = localStorage.getItem("uid") || Date.now();
localStorage.setItem("uid", userIds);

// PAGE VIEW
fetch("/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        userId: userIds,
        page: window.location.pathname,
        action: "view"
    })
});

// CLICK TRACK
document.addEventListener("click", (e) => {
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: userIds,
            page: window.location.pathname,
            action: "click"
        })
    });
});


menu();

MainLoadingAnimation();