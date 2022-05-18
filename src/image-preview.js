const { makeBaseImage } = require("./image-processing")
const fabric = require("fabric").fabric;


document.getElementById("update-image").addEventListener('click', () => {
    makeBaseImage(
        {
            title: "USPS and its plan to get back on top",
            content: {
                ops: [
                    {
                        attributes: {
                            italic: true
                        },
                        insert: "Delivering for America"
                    },
                    {
                        insert: " is the Postal Service's plan to go back on the green after over a decade of bleeding money.\n"
                    }
                ]
            },
            img: {
                src: "aerial_view-big_custom.png",
                reverse_fit: true
            }
        }, "D:\\Users\\matab\\Pictures\\SolveIt News\\news\\6qgod1wv",
        (buffer) => {
            const canvas = new fabric.Canvas('output-img');
            
            fabric.Image.fromURL('data:image/jpeg;base64,' + buffer.toString('base64'), (img) => {
                canvas.add(img)
                const rect = new fabric.Rect({
                  left: 10,
                  top: 10,
                  width: 140,
                  height: 215,
                  fill: "rgba(44, 109, 195, 0.62)",
                  rx:10,
                  ry:10
                });
                canvas.add(rect);
            })
        }
    )

})