import { updateImagePreview, getPosition, getWidth, exportSlideToJpegData } from "./image-processing.js"

const Parchment = Quill.import('parchment')

// Main data object
const mainData = (window.localStorage.getItem('data') === null) ? createCollectionObj() : JSON.parse(window.localStorage.getItem('data'));
var currentArticle;
var currentSlide;
var curr_slide_list_item;

class QuillCitationBlot extends Parchment.Embed {

    static create(value) {
        let node = super.create();
        node.setAttribute('key', value.key);
        node.setAttribute('citation_manager', value.manager)
        node.setAttribute('contenteditable', false);
        node.textContent = `@${value.key}`
        // node.textContent = getString(node);
        return node;
    }

    static value(node) {
        return {
            key: node.getAttribute('key')
        }
    }
}
QuillCitationBlot.blotName = "citation"
QuillCitationBlot.tagName = "citation"
Quill.register(QuillCitationBlot)

class QuillCitationManager {
    constructor(quill, options) {
        this.quill = quill;
        this.options = options
        // this.manager = options.manager
        quill.on('text-change', this.update.bind(this))
    }

    update(delta, prev, source) {
        console.log(this.quill.getContents())
        if (source === "user") {
            if (delta.ops.some(e => e.insert === "@")) {
                const retain_obj = delta.ops.find(e => e?.retain !== undefined)
                const idx_to_add = (retain_obj === undefined) ? 0 : retain_obj.retain

                this.quill.enable(false)
                this.#getCitationId(idx_to_add + 1).then(res => {
                    const citation_id = res
                    if (citation_id !== undefined && citation_id !== "") {
                        this.quill.deleteText(idx_to_add, 1)

                        this.quill.insertEmbed(idx_to_add, 'citation', { idx: 0, key: citation_id }, 'api')

                        this.quill.enable(true)
                        this.quill.setSelection(idx_to_add + 1, Quill.sources.API);
                    } else {
                        this.quill.enable(true)
                        this.quill.deleteText(idx_to_add, 1)
                    }
                }).catch(err => {
                    this.quill.deleteText(idx_to_add, 1)
                    this.quill.enable(true)
                })
            }
        }
    }

    #getCitationId(quill_idx) {
        return new Promise((resolve, reject) => {
            // First create the dropdown
            const drop_container = document.getElementById('citaitons-dropdown')
            const srcs_container = document.getElementById('sources-container')
            const search_box = document.getElementById('citation-search')
            drop_container.classList.remove('hidden')

            const { left, top } = this.quill.container.getBoundingClientRect()
            drop_container.style.left = `${left + this.quill.getBounds(quill_idx).left}px`
            drop_container.style.top = `${top + this.quill.getBounds(quill_idx).top}px`

            search_box.value = ""
            search_box.onblur = (e) => {
                if (!((e.explicitOriginalTarget?.classList)?.contains('citation-list-item') || (e.explicitOriginalTarget?.parentNode?.classList)?.contains('citation-list-item'))) {
                    drop_container.classList.add('hidden')
                    reject('Clicked Away');
                }
            }

            while (srcs_container.firstChild) {
                srcs_container.removeChild(srcs_container.firstChild);
            }

            for (const id of ['aguera-arcasLargeLanguageModels2022', 'antonySecretaryBlinkenRemarks2021', 'thoppilanLaMDALanguageModels2022']) {
                const item = document.createElement('div')
                item.innerHTML = id
                item.classList.add('citation-list-item')

                // Item should resolve the promise once clicked and hide everything
                item.addEventListener('click', (e) => {
                    drop_container.classList.add('hidden')
                    resolve(id)
                })

                srcs_container.appendChild(item)
            }

            search_box.focus()
        })
    }
}

class CitationManager {
    constructor() {
        this.cite_order = new Array()
    }

    addParent() {
        const new_id = Date.now()
        this.cite_order.push({
            id: new_id,
            citations: new Array()
        })
        return new_id
    }

    updateCitations(parent_id, quill){
        const new_citations = new Array()
        for(const item of (quillSlide instanceof Quill) ? quill.getContents().ops : quill.ops){
            if(item?.citation !== undefined && !new_citations.includes(item.citation.key)){
                new_citations.push(item.citation.key)
            }
        }
        this.cite_order.find(e => e.id === parent_id).citations = new_citations
    }

    moveParentUp(id) {
        moveItemUpInArray(this.cite_order.find(e => e.id === id), this.cite_order)
    }

    moveParentDown(id) {
        moveItemDownInArray(this.cite_order.find(e => e.id === id), this.cite_order)
    }
}

Quill.register('modules/citation', QuillCitationManager)

const quillSlide = new Quill('#slide_content', {
    modules: {
        toolbar: "#toolbar",
        history: {
            maxStack: 250,
            userOnly: true
        },
        citation: {

        }
    },
    placeholder: 'Enter the contents of the slide',
    theme: 'snow',
    formats: [
        'bold',
        'italic',
        'link',
        'script',
        'list',
        'citation',
        // 'citationEnd',
    ]
});

const quillDescription = new Quill('#article-description', {
    modules: {
        toolbar: "",
        history: {
            maxStack: 250,
            userOnly: true
        }
    },
    placeholder: 'Article\'s Instagram description',
    theme: 'snow',
    formats: []
});

const quillSources = new Quill('#sources-intput', {
    modules: {
        toolbar: "",
        history: {
            maxStack: 250,
            userOnly: true
        }
    },
    placeholder: 'Article\'s Sources',
    theme: 'snow',
    formats: []
})

const quillArticle = new Quill('#article-qill', {
    modules: {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
            ['blockquote', 'code-block'],

            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript

            ['clean']                                         // remove formatting button
        ],
        history: {
            maxStack: 250,
            userOnly: true
        }
    },
    placeholder: 'Write your full article here!',
    theme: 'snow',
    formats: [
        'bold',
        'color',
        'code',
        'italic',
        'link',
        'size',
        'script',
        'underline',
        'blockquote',
        'header',
        'indent',
        'list',
        'code-block',
        'formula',
        'image',
        'video',
    ]
});


const makeBaseAndUpdate = () => {
    saveProgressToObj()
    // Only while debugging
    updateImagePreview(currentSlide)
}

updateArticlesList()

// When you change slide contents
quillSlide.on('text-change', (delta, oldContents, source) => {
    if (currentSlide && source === "user") {
        makeBaseAndUpdate()
    }
})

// When you change slide contents
quillDescription.on('text-change', (delta, old_contents, source) => {
    if (currentArticle && source === "user") {
        currentArticle.desc = quillDescription.getText();
    }
})

quillSources.on('text-change', (delta, old_content, source) => {
    if (currentArticle && source === "user") {
        console.log(`Still Working adding this to bib: ${quillSources.getText()}`)
        // currentArticle.bib = new Cite(quillSources.getText())
    }
})

// When you change slide contents
quillArticle.on('text-change', (delta, oldContents, source) => {
    if (currentArticle && source === "user") {
        currentArticle.article = quillArticle.getContents();
    }
})

{
    const expiration_date = window.localStorage.getItem('accepted-terms-expiration')
    if (expiration_date === null || Date.now() > Date.parse(expiration_date)) {
        document.getElementById("policyNotice").style.display = "block";
    } else {
        document.getElementById("policyNotice").style.display = "none";
    }

    document.getElementById('acknowledge-btn').addEventListener('click', () => {
        const now = new Date()
        now.setMonth(now.getMonth() + 1)
        window.localStorage.setItem('accepted-terms-expiration', now.toString())
        document.getElementById("policyNotice").style.display = "none";
    })
}

document.getElementById('save-progress').addEventListener('click', () => {
    showLoading()
    saveToBrowser()
    hideLoading()
})

document.getElementById('export-btn').addEventListener('click', (e) => {
    showLoading()
    saveToBrowser(true)
    var zip = new JSZip()

    zip.file('collection.json', JSON.stringify(mainData))

    for (const art of mainData.articles) {
        const folder_name = art.slides[0].title.replace(/[^a-zA-Z0-9 ]/g, "")

        if (art?.article !== undefined) {
            quillArticle.setContents(art.article)
            zip.file(`${folder_name}/article.txt`, quillArticle.getText(), { binary: false })
            zip.file(`${folder_name}/article.json`, JSON.stringify(art.article))
        }

        if (art?.desc !== undefined) {
            zip.file(`${folder_name}/instagram_desc.txt`, `🪡 ${art.slides[0].title}\n\n${art.desc}`, { binary: false })
        }
        for (let i = 0; i < art.slides.length; i++) {
            zip.file(`${folder_name}/${i}.jpeg`, exportSlideToJpegData(art.slides[i]), { base64: true, createFolders: true })
        }
    }

    zip.generateAsync({ type: "base64" }, (progress_meta) => {
        updateLoadingMessage(`Compressing Zip: ${progress_meta.percent.toFixed(2)}%`)
    })
        .then((uri) => {
            var download_el = document.createElement('a');
            download_el.setAttribute('href', "data:application/zip;base64," + uri);
            download_el.setAttribute('download', 'collection.zip');

            if (document.createEvent) {
                var event = document.createEvent('MouseEvents');
                event.initEvent('click', true, true);
                download_el.dispatchEvent(event);
            }
            else {
                download_el.click();
            }
        }).finally(() => {
            hideLoading()
        })
})


document.getElementById('import-btn').addEventListener('click', () => {
    // Cannot use the show/hide loading since there's no Cancel event
    // showLoading()

    // Promise resolves with loaded data
    const loading_promise = new Promise((resolve, reject) => {
        const file_loader = document.createElement('input')
        file_loader.type = "file"
        file_loader.accept = ".json,.zip"

        file_loader.addEventListener('input', (e) => {
            try {
                // ZIP File
                if (file_loader.files[0].name.endsWith('zip')) {
                    JSZip.loadAsync(file_loader.files[0])
                        .then((zip) => {
                            zip.file('collection.json').async("string").then(result => {
                                // console.log(result)
                                resolve(JSON.parse(result))
                            }).catch(reject)
                        })
                        .catch(reject)
                } else {
                    const reader = new FileReader();

                    reader.addEventListener("load", () => {
                        resolve(JSON.parse(reader.result))
                    }, false);

                    reader.readAsText(file_loader.files[0])
                }
            } catch (error) {
                reject(error)
            }
        })

        file_loader.click()

        // Reject the promise if file not selected in 10 seconds
        setTimeout(() => reject('Timeout'), 10000);
    })

    loading_promise
        .then(data => {
            for (const article of data.articles) {
                mainData.articles.push(article)
            }
            saveToBrowser(false)
            updateArticlesList()
        })
        .catch(err => { console.log(err) })
})


document.getElementById('insta-article-selector').addEventListener('click', (e) => {
    saveProgressToObj()
    for (const el of document.getElementsByClassName('instagram')) {
        el.classList.toggle('hidden')
    }
    for (const el of document.getElementsByClassName('non-instagram')) {
        el.classList.toggle('hidden')
    }
    for (const el of document.querySelectorAll("#insta-article-selector > *")) {
        el.classList.toggle('selected-layout')
        el.classList.toggle('unselected-layout')
    }
})

// Title input
document.getElementById('slide_title').addEventListener('input', (e) => {
    currentSlide.title = e.target.value;
    curr_slide_list_item.innerHTML = getSlideTitle(currentSlide)
    if (currentSlide === currentArticle.slides[0]) {
        document.querySelector("#articles_list > .selected").innerHTML = getSlideTitle(currentSlide)
    }
    makeBaseAndUpdate()
})

// Title de-focused
document.getElementById('slide_title').addEventListener('blur', (e) => {
    saveToBrowser(true);
})

// Listen to beggining of draging something over the canvas container
document.getElementById('canvas-container').addEventListener("dragover", draggoverHandler)

// Something dropped over the canvas container
document.getElementById('canvas-container').addEventListener("drop", (e) => {
    showLoading()
    dropHandler(e, currentSlide)
        .then(slide => {
            updateImagePreview(slide).finally(hideLoading)
        })
        .finally(hideLoading)
})

document.getElementById('image-load-btn').addEventListener('click', e => {
    askForImageAndAddToslide(currentSlide).then(updateImagePreview)
})

// Invert Image Checkbox
document.getElementById('inverse-fit-checkbox').addEventListener('change', (e) => {
    currentSlide.img.reverse_fit = e.target.checked
    document.querySelector('#hide-blurred-background-container').hidden = !e.target.checked
    // To ensure it is properly re-set
    if (!e.target.checked) {
        currentSlide.img.top = null
        currentSlide.img.width = null
    }
    updateImagePreview(currentSlide)
    saveToBrowser(false);
})

// Hide Background Image Checkbox
document.getElementById('hide-blurred-background-checkbox').addEventListener('change', (e) => {
    currentSlide.img.hide_blr_bk = e.target.checked
    makeBaseAndUpdate()
    saveToBrowser(false);
})

// Remove Slide Button
document.getElementById("rmv_btn").addEventListener('click', () => {
    removeSlide()
})

// Add Slide Button
document.getElementById("nxt_btn").addEventListener('click', () => {
    if (currentArticle.slides.length < 10) {
        makeNewSlide()
    }
})

// Add Article Button
document.getElementById("add_art_btn").addEventListener('click', () => { addArticle() })

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

// Searching for citation ids
document.getElementById('citation-search').addEventListener('input', e => {
    const filter = e.target.value.toUpperCase();
    const items = document.getElementById("sources-container").getElementsByTagName("div");
    for (var i = 0; i < items.length; i++) {
        var txtValue = items[i].textContent || items[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            items[i].style.display = "";
        } else {
            items[i].style.display = "none";
        }
    }
})

function draggoverHandler(e) {
    e.stopPropagation()
    e.preventDefault()

    e.dataTransfer.dropEffect = "move";
}

// Returns a promise that resolves with the updated slide
function dropHandler(e, slide = currentSlide) {
    return new Promise((resolve, reject) => {
        e.stopPropagation()
        e.preventDefault()

        try {
            if (e.dataTransfer.files.length && e.dataTransfer.files[0]?.type?.startsWith('image/') && e.dataTransfer.files[0]?.type !== "image/bmp") {
                const reader = new FileReader()

                reader.addEventListener("load", () => {
                    // convert image file to base64 string
                    slide.img.src = reader.result;
                    resolve(slide)
                }, false);

                reader.readAsDataURL(e.dataTransfer.files[0])
            } else {
                const url = new URL(e.dataTransfer.getData("URL"));
                const html_data = document.createElement('div')
                html_data.innerHTML = e.dataTransfer.getData('text/html')
                if (url.searchParams.has('imgurl')) {
                    slide.img.src = url.searchParams.get('imgurl')
                    // } if (html_data.getElementsByTagName('img')[0]?.src !== undefined) {
                    //     slide.img.src = html_data.getElementsByTagName('img')[0].src
                } else {
                    slide.img.src = url.href
                }
                resolve(slide)
            }
        } catch (err) {
            reject(err)
        }
    })
}

function updateArticlesList(update_current = true) {
    let list = document.getElementById("articles_list");
    clearChildren(list)

    if (mainData.articles.length > 0) {
        if (update_current) {
            currentArticle = mainData.articles[0];
        }
        for (let i = 0; i < mainData.articles.length; i++) {
            let new_it = document.createElement('li')
            let new_it_text = document.createTextNode(getSlideTitle(mainData.articles[i].slides[0]))
            new_it.appendChild(new_it_text)
            new_it.value = i;
            new_it.addEventListener('click', (e) => {
                saveProgressToObj()

                clearSelected(list)
                e.target.classList.add('selected')

                currentArticle = mainData.articles[i];
                updateSlidesList();

                quillDescription.setText((currentArticle?.desc === undefined) ? "" : currentArticle.desc)
                quillDescription.history.clear();

                quillArticle.setContents(currentArticle?.article)
                quillArticle.history.clear();
            })

            if (mainData.articles[i] === currentArticle)
                new_it.classList.add('selected')
            list.appendChild(new_it);
        }

        quillDescription.setText((currentArticle?.desc === undefined) ? "" : currentArticle.desc)
        quillDescription.history.clear();

        quillArticle.setContents(currentArticle?.article)
        quillArticle.history.clear();

        updateSlidesList(update_current);
    } else {
        addArticle()
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

            curr_slide_list_item.classList.remove('selected')
            e.target.classList.add('selected')
            currentSlide = slide
            curr_slide_list_item = e.target

            updateSlide();
        })

        new_it.setAttribute("draggable", "true")

        new_it.addEventListener('dragover', draggoverHandler, false)

        new_it.addEventListener('drop', e => {
            dropHandler(e, slide).then(updated_slide => {
                if (updated_slide === currentSlide) {
                    updateImagePreview(updated_slide)
                }
            })
        }, false)

        if (currentArticle.slides[i] === currentSlide) {
            curr_slide_list_item = new_it
            new_it.classList.add('selected')
        }
        list.appendChild(new_it);
    }

    updateSlide();
}

function updateSlide() {
    document.getElementById('inverse-fit-checkbox').checked = currentSlide.img.reverse_fit
    document.getElementById('hide-blurred-background-container').hidden = !currentSlide.img.reverse_fit
    document.getElementById('hide-blurred-background-checkbox').checked = currentSlide.img.hide_blr_bk
    slide_title.value = currentSlide.title;
    quillSlide.setContents(currentSlide.content);
    quillSlide.history.clear();
    updateImagePreview(currentSlide)
}

function addArticle(title) {
    currentArticle.desc = quillDescription.getText()

    currentSlide = createSlideObj();
    currentSlide.title = (title === undefined) ? '' : title;
    currentArticle = createArticleObj()
    currentArticle.slides[0] = currentSlide

    mainData.articles.push(currentArticle)
    updateArticlesList(false);
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
        saveToBrowser(false);
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

    moveItemUpInArray(currentSlide, currentArticle.slides)

    updateSlidesList(false)
}

function moveSlideDown() {
    saveProgressToObj()

    moveItemDownInArray(currentSlide, currentArticle.slides)

    updateSlidesList(false)
}

// Returns a promise that will be resolved once the file has been updated (passing it the new slide)
function askForImageAndAddToslide(slide) {
    return new Promise((resolve, reject) => {
        const file_loader = document.createElement('input')
        file_loader.type = "file"
        file_loader.accept = "image/*"
        file_loader.addEventListener('input', (e) => {
            try {
                const reader = new FileReader()

                reader.addEventListener("load", () => {
                    // convert image file to base64 string
                    slide.img.src = reader.result;
                    resolve(slide)
                }, false);

                reader.readAsDataURL(file_loader.files[0])
            } catch (error) {
                reject(error)
            }
        })

        file_loader.click()
    })
}

function saveProgressToObj() {
    // The description content is handled by quill

    currentSlide.title = slide_title.value
    currentSlide.content = quillSlide.getContents()
    if (currentSlide.img.reverse_fit) {
        currentSlide.img.top = getPosition()
        currentSlide.img.width = getWidth()
    } else {
        currentSlide.img.top = null
        currentSlide.img.width = null
    }
}

function saveToBrowser(update_current = true) {
    if (update_current)
        saveProgressToObj()
    window.localStorage.setItem('data', JSON.stringify(mainData))
}

function showLoading() {
    document.getElementById('loading-container').style.display = 'block'
}

function updateLoadingMessage(msg) {
    document.querySelector("#loading-container > .loader-message").textContent = msg
}

function hideLoading() {
    document.getElementById('loading-container').style.display = 'none'
    updateLoadingMessage("")
}

function createCollectionObj() {
    return {
        articles: [createArticleObj()]
    }
}

function createArticleObj() {
    return {
        slides: [createSlideObj()],
        desc: ""
    }
}

function createSlideObj() {
    return { title: "", content: {}, img: { src: "", reverse_fit: false, hide_blr_bk: false, top: null, width: null } }
}

function getSlideTitle(slide) {
    return (slide.title === '') ? 'No Title' : slide.title
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

function moveItemUpInArray(item, array){
    const old_idx = array.indexOf(item)
    if (old_idx > 0) {
        [array[old_idx - 1], array[old_idx]] =
            [array[old_idx], array[old_idx - 1]]
    }
}

function moveItemDownInArray(item, array){
    const old_idx = array.indexOf(item)
    if (old_idx < array.length - 1) {
        [array[old_idx], array[old_idx + 1]] =
            [array[old_idx + 1], array[old_idx]]
    }
}

function clearSelected(el) {
    for (let i = 0; i < el.children.length; i++) {
        el.children[i].classList.remove('selected')
    }
}