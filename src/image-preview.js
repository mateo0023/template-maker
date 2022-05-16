const { makeBaseImage, makeFullImage } = require("./image-processing")

document.getElementById("update-image").addEventListener('click', () => {
    makeBaseImage(currentSlide, (s, buff) => {
        makeFullImage(s, buff, "./test.jpg")
    })
})