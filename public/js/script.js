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



