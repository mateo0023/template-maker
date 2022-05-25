
(() => {
    const { ipcRenderer, dialog } = require('electron');
    const path = require('path')
    const { makeBaseImage, updateSampleImage, makeFullImage, updateImagePreview, exportSlideToFile } = require("./image-processing")
    const AUTO_SAVE = false;

    // Main data object
    var mainData;
    var working_path;
    var currentArticle;
    var currentSlide;
    var curr_slide_list_item;

    var quill = new Quill('#slide_content', {
        modules: {
            toolbar: "#toolbar"
        },
        placeholder: 'Enter the contents of the slide',
        theme: 'snow'
    });

    const makeBaseAndUpdate = () => {
        makeBaseImage(currentSlide, working_path, (buff) => { updateSampleImage(currentSlide, buff, quill) })
    }

    // ******************************************************
    // ******************************************************
    // ***************** ONLY FOR DEBUGGING *****************
    // ******************************************************
    // ******************************************************
    document.getElementById("update-image").addEventListener('click', () => {
        saveProgressToObj()
        updateImagePreview(currentSlide, working_path)
        // makeBaseImage(currentSlide, working_path, (buff) => {
        //     makeFullImage(buff, currentSlide)
        // })
    })

    ipcRenderer.on('file:opened', (e, data, path) => {
        document.querySelector('body').hidden = false;

        mainData = data
        working_path = `${path}`

        updateArticlesList();
    })

    ipcRenderer.on('file:save-request', (e, data) => {
        saveProgressToObj();
        e.sender.send('file:save-response', mainData);
        updateArticlesList(false);
    })

    ipcRenderer.on('export-request', (event) => {
        saveProgressToObj()
        event.sender.send('export-response', mainData)
    })

    ipcRenderer.on('title-response', (e, result) => {
        currentSlide = createSlideObj();
        currentSlide.title = result;
        let art = { title: result, slides: [currentSlide] }
        currentArticle = art

        mainData.articles.push(art)

        updateArticlesList(false);
    })

    ipcRenderer.on('make-article', makeNewArticle)
    ipcRenderer.on('remove-article', removeArticle)
    ipcRenderer.on('make-slide', makeNewSlide)
    ipcRenderer.on('remove-slide', removeSlide)
    ipcRenderer.on('move-slide-up', moveSlideUp)
    ipcRenderer.on('move-slide-down', moveSlideDown)

    // When you change slide contents
    quill.on('text-change', () => {
        if (currentSlide) {
            makeBaseAndUpdate()
        }
    })

    // Title input
    document.getElementById('slide_title').addEventListener('input', (e) => {
        currentSlide.title = e.target.value;
        curr_slide_list_item.innerHTML = (currentSlide.title === '') ? 'No Title' : currentSlide.title
        makeBaseAndUpdate()
    })

    // Title de-focused
    if (AUTO_SAVE) {
        document.getElementById('slide_title').addEventListener('blur', (e) => {
            saveToFile();
        })
    }

    // Image Selector Button
    document.getElementById("image_selector").addEventListener('click', () => {
        saveProgressToObj();
        ipcRenderer.invoke('select-image').then((result) => {
            currentSlide.img.src = result.rel
            document.getElementById("selected_image").src = result.abs
            makeBaseAndUpdate()
            if (AUTO_SAVE) {
                saveToFile();
            }
        })
    })

    // Invert Image Checkbox
    document.getElementById('inverse-fit-checkbox').addEventListener('change', (e) => {
        currentSlide.img.reverse_fit = e.target.checked
        document.querySelector('#hide-blurred-background-container').hidden = !e.target.checked
        makeBaseAndUpdate()
        if (AUTO_SAVE) {
            saveToFile();
        }
    })

    // Invert Image Checkbox
    document.getElementById('hide-blurred-background-checkbox').addEventListener('change', (e) => {
        currentSlide.img.hide_blr_bk = e.target.checked
        makeBaseAndUpdate()
        if (AUTO_SAVE) {
            saveToFile();
        }
    })

    // Remove Slide Button
    document.getElementById("rmv_btn").addEventListener('click', () => {
        removeSlide()
    })

    // Add Slide Button
    document.getElementById("nxt_btn").addEventListener('click', () => {
        makeNewSlide()
    })

    // Add Article Button
    document.getElementById("add_art_btn").addEventListener('click', makeNewArticle)

    // Remove Article Button
    document.getElementById("remove_art").addEventListener('click', () => {
        removeArticle()
    })

    // Move slide up Button
    document.getElementById('move_slide_up').addEventListener('click', () => {
        moveSlideUp()
    })

    // Move slide Down Button
    document.getElementById('move_slide_down').addEventListener('click', () => {
        moveSlideDown()
    })

    function updateArticlesList(update_current = true) {
        let list = document.getElementById("articles_list");
        clearChildren(list)

        if (mainData.articles.length > 0) {
            if (update_current) {
                currentArticle = mainData.articles[0];
            }
            for (let i = 0; i < mainData.articles.length; i++) {
                let new_it = document.createElement('li')
                let new_it_text = document.createTextNode(mainData.articles[i].title)
                new_it.appendChild(new_it_text)
                new_it.value = i;
                new_it.addEventListener('click', (e) => {
                    saveProgressToObj()

                    clearSelected(list)
                    e.target.classList.add('selected')

                    currentArticle = mainData.articles[i];
                    updateSlidesList();
                })

                if (mainData.articles[i] === currentArticle)
                    new_it.classList.add('selected')
                list.appendChild(new_it);
            }

            updateSlidesList(update_current);
        } else {
            makeNewArticle()
        }
    }

    function updateSlidesList(update_current = true) {
        let list = document.getElementById("slides_list");
        clearChildren(list);

        if (update_current) {
            currentSlide = currentArticle.slides[0];
        }
        for (let i = 0; i < currentArticle.slides.length; i++) {
            let slide = currentArticle.slides[i]
            let new_it = document.createElement('li')
            let new_it_text = document.createTextNode(
                (slide.title === '') ? 'No Title' : slide.title
            )
            new_it.appendChild(new_it_text)

            new_it.value = i + 1
            new_it.id = `slide_item_${i}`
            new_it.addEventListener('click', (e) => {
                saveProgressToObj();

                clearSelected(list)
                e.target.classList.add('selected')
                currentSlide = slide
                curr_slide_list_item = e.target

                updateSlide();
            })

            if (currentArticle.slides[i] === currentSlide) {
                curr_slide_list_item = new_it
                new_it.classList.add('selected')
            }
            list.appendChild(new_it);
        }

        updateSlide();
    }

    function updateSlide() {
        document.getElementById("selected_image").src = (currentSlide.img.src === '') ? '' : `${path.join(working_path, currentSlide.img.src)}`
        document.getElementById('inverse-fit-checkbox').checked = currentSlide.img.reverse_fit
        document.getElementById('hide-blurred-background-container').hidden = !currentSlide.img.reverse_fit
        document.getElementById('hide-blurred-background-checkbox').checked = currentSlide.img.hide_blr_bk
        slide_title.value = currentSlide.title;
        quill.setContents(currentSlide.content);
        makeBaseAndUpdate()
    }

    function makeNewArticle() {
        // Need to get a popup with the new title:

        ipcRenderer.send('ask-title')
    }

    function removeArticle() {
        removeItemFromArr(mainData.articles, currentArticle)

        // It already makes new Article if needed
        updateArticlesList(true)
    }

    function makeNewSlide() {
        saveProgressToObj()

        let new_slide = createSlideObj();
        currentArticle.slides.push(new_slide)
        currentSlide = new_slide

        updateSlidesList(false);
        if (AUTO_SAVE) {
            saveToFile();
        }
    }

    function removeSlide() {
        removeItemFromArr(currentArticle.slides, currentSlide)
        if (currentArticle.slides.length === 0) {
            removeItemFromArr(mainData.articles, currentArticle)

            // It already makes new Article if needed
            updateArticlesList(true)
        } else {
            updateSlidesList(true)
        }
    }

    function moveSlideUp() {
        saveProgressToObj()

        let old_idx = currentArticle.slides.indexOf(currentSlide)
        if (old_idx > 0) {
            [currentArticle.slides[old_idx - 1], currentArticle.slides[old_idx]] =
                [currentArticle.slides[old_idx], currentArticle.slides[old_idx - 1]]
        }

        updateSlidesList(false)
    }

    function moveSlideDown() {
        saveProgressToObj()

        let old_idx = currentArticle.slides.indexOf(currentSlide)
        if (old_idx < currentArticle.slides.length - 1) {
            [currentArticle.slides[old_idx], currentArticle.slides[old_idx + 1]] =
                [currentArticle.slides[old_idx + 1], currentArticle.slides[old_idx]]
        }

        updateSlidesList(false)
    }


    function saveProgressToObj() {
        // The slide content is handled by quill

        currentSlide.title = slide_title.value
        currentSlide.content = quill.getContents()
    }

    function saveToFile() {
        saveProgressToObj()
        ipcRenderer.send('save-request', mainData)
    }

    function createSlideObj() {
        return { title: "", content: {}, img: { src: "", reverse_fit: false, hide_blr_bk: false } }
    }

    function clearChildren(el) {
        while (el.hasChildNodes()) {
            el.removeChild(el.firstChild);
        }
    }

    // Since it's pass-by-ref, there's no need to return the array
    function removeItemFromArr(arr, item) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === item) {
                arr.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    function clearSelected(el) {
        for (let i = 0; i < el.children.length; i++) {
            el.children[i].classList.remove('selected')
        }
    }


})();