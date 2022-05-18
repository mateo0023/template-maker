
const sharp = require('sharp')
const path = require('path')
const fabric = require("fabric").fabric

sharp.cache(false)

const CORNER_RADIUS = 43.2;

async function updateSampleImage(slide_obj, base_img_buff, quill_obj) {
    const added_txt_padding = 43.2 * 2
    const img_out = document.getElementById("sample-output-img")

    // Process the new image if complete
    if (!(slide_obj.title === '' && slide_obj.content === '')) {
        let content_height = 0
        const quill_contents = document.getElementById('slide_content').children[0].children
        for (let i = 0; i < quill_contents.length && quill_obj.getLength() > 1; i++) {
            content_height += quill_contents[i].clientHeight
        }
        // Convert from HTML px to real pixels
        content_height *= 2.371900826446281;

        sharp(base_img_buff).composite([
            // Create content box only if there's content
            ...((content_height > 0) ?

                [{
                    input: await sharp({
                        create: {
                            width: 993,
                            height: Math.round(content_height + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: Math.round(1350 - content_height - added_txt_padding - 47),
                    left: 47
                }] : []
            ),
            // Create title box only if there's a title
            ...((slide_obj.title.length > 0) ?
                [{
                    input: await sharp({
                        create: {
                            width: 993,
                            // Roughly 27 chars per line, 60 pixels per line
                            height: Math.round(Math.ceil(slide_obj.title.length / 27) * 60 + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: 47,
                    left: 47
                }] : [])
        ])
            .jpeg().toBuffer((e, buff, info) => {
                if (e) {
                    console.log(e)
                    img_out.src = ''
                } else {
                    img_out.src = 'data:image/jpeg;base64,' + buff.toString('base64');
                }
            })
    } else {
        img_out.src = 'data:image/jpeg;base64,' + base_img_buff.toBuffer().toString('base64');
    }
}

// This should use the Canvas API to add the text to the pre_processed buffer
function makeFullImage(buffer, quill_obj, slide_obj) {
    const canvas = new fabric.Canvas('output-img');
    const added_txt_padding = 43.2 * 2

    let content_height = 0
    const quill_contents = document.getElementById('slide_content').children[0].children
    for (let i = 0; i < quill_contents.length && quill_obj.getLength() > 1; i++) {
        content_height += quill_contents[i].clientHeight
    }
    // Convert from HTML px to real pixels
    content_height *= 2.371900826446281;

    fabric.Image.fromURL('data:image/jpeg;base64,' + buffer.toString('base64'), (img) => {
        canvas.add(img)
        canvas.add(makeRect(47, 47, 993, Math.round(Math.ceil(slide_obj.title.length / 27) * 60 + added_txt_padding)));
        canvas.add(makeRect(47, Math.round(1350 - content_height - added_txt_padding - 47), 993, Math.round(content_height + added_txt_padding)));
    })
}

function makeRect(x, y, width, height) {
    return new fabric.Rect({
        left: x,
        top: y,
        width: width,
        height: height,
        fill: "rgba(44, 109, 195, 0.62)",
        rx: CORNER_RADIUS,
        ry: CORNER_RADIUS
    });
}

// Sets the curr_pre_processed_image to the most current values of slide
// Will call the _callback function with the updated base_lyr
async function makeBaseImage(slide, working_path, _callback = () => { }) {
    if (slide.img.src === '' || slide.img.src === undefined) {
        // Make the callback to the object
        _callback(
            await sharp({
                create: {
                    width: 1080,
                    height: 1350,
                    channels: 3,
                    background: { r: 29, g: 219, b: 121, }
                }
            }).jpeg().toBuffer()
        )
    } else {
        const full_image_path = path.join(working_path, slide.img.src)

        const foreground_img = await sharp(full_image_path)
            .resize(1080, 1350, { fit: (slide.img.reverse_fit) ? "inside" : "cover" })

        let base_lyr = sharp({
            create: {
                width: 1080,
                height: 1350,
                channels: 3,
                background: { r: 0, g: 0, b: 0 }
            }
        }).composite([
            // Add the blurred background only if necessary
            ...((slide.img.reverse_fit) ?
                [{
                    input: await (sharp(full_image_path).resize(1080, 1350, { fit: "cover" }).blur(20).toBuffer()),
                    top: 0,
                    left: 0
                }]
                : []),
            // Background Image
            {
                input: await foreground_img.toBuffer(),
                top: (slide.img.reverse_fit) ? Math.round((1350 - (await foreground_img.metadata()).height) / 2) : 0,
                left: 0
            }])

        if (path.extname(slide.img.src) === '.png') {
            base_lyr = await base_lyr.png()
        } else if (path.extname(slide.img.src) === '.jpeg' || path.extname(slide.img.src) === '.jpg') {
            base_lyr = await base_lyr.jpeg()
        }

        // if (to_file && path_to_save) {
        //     base_lyr.toFile(path_to_save)

        //     slide.img.pre_processed_path = path.relative(working_path, path_to_save)
        // } else if (to_file) {
        //     let pre_processed_img_path = full_image_path.split('.')
        //     pre_processed_img_path[pre_processed_img_path.length - 2] += '_pre-processed'
        //     pre_processed_img_path = pre_processed_img_path.join('.')
        //     base_lyr.toFile(pre_processed_img_path)

        //     slide.img.pre_processed_path = path.relative(working_path, pre_processed_img_path)
        // } else {
        //     slide.img.pre_processed_path = ''
        // }

        _callback(await base_lyr.toBuffer())
    }
}

module.exports = {
    updateSampleImage,
    makeBaseImage,
    makeFullImage
}