import { updateImagePreview, getPosition, getWidth, exportSlideToJpegData } from "./image-processing.js"
import { getCitationIndexes, getBib, getZoteroCollections, getCitationList, getWorksCitedText, getWorksCitedHTML } from "./citations.js"

class QuillCitationBlot extends Quill.import('blots/embed') {
    static blotName = 'citation'
    static tagName = 'citation'

    static create(value) {
        const node = super.create();
        node.setAttribute('key', value.key);
        node.setAttribute('index', value?.index);
        if (value.index === 'undefined' || value.index === undefined) {
            node.textContent = `@${value.key}`
            node.style = "background-color: #ddd; text-decoration: underline;"
        } else {
            const sup = document.createElement('sup')
            const link = document.createElement('a')
            link.href = `#@${value.key}`
            link.textContent = value.index
            sup.appendChild(link)
            node.appendChild(sup)
        }
        return node;
    }

    static value(node) {
        return {
            key: node.getAttribute('key'),
            index: node.getAttribute('index')
        }
    }

    // All blank so that they cannot be formatted
    static formats(domNode) { }

    // Apply format to blot. Should not pass onto child or other blot.
    format(format, value) { }

    // Return formats represented by blot, including from Attributors.
    formats() { return {} }
}
Quill.register(QuillCitationBlot)


const CitationManagerModes = {
    FULL_TEXT: "FULL_TEXT", INSTAGRAM: "INSTAGRAM"
}

class QuillCitationManager {

    constructor(quill, options) {
        this.quill = quill;
        this.options = options
        quill.on('text-change', this.update.bind(this))
    }

    update(delta, prev, source) {
        if (source === "user") {
            if (delta.ops.some(e => e.insert === "@")) {
                const retain_obj = delta.ops.find(e => e?.retain !== undefined)
                const idx_to_add = (retain_obj === undefined) ? 0 : retain_obj.retain
                
                this.#addCitation(idx_to_add)
            } else if (delta.ops.some(e => e.delete !== undefined)) {
                if (
                    // Finds deleted blobs and then checks wether at least one is a citation object
                    QuillCitationManager.findDeletedBlobs(prev, delta.ops.find(e => e?.retain !== undefined)?.retain, delta.ops.find(e => e.delete !== undefined).delete)
                        .some(e => e?.insert?.citation !== undefined)
                ) {
                    if (this.options.version !== CitationManagerModes.FULL_TEXT) {
                        Slide.setContents(currentSlide, this.quill.getContents())
                        Article.updateInstaCitations(currentArticle)
                        updateImagePreview(currentSlide, currentArticle.instagram_citations)
                    } else {
                        Article.updateFullTextCitations(currentArticle, this.quill.getContents())
                    }
                }
            }
        }
    }

    #addCitation(idx_to_add = this.quill.getSelection().index){
        this.quill.enable(false)
        this.#getCitationKey(idx_to_add + 1).then(citation_key => {
            this.quill.deleteText(idx_to_add, 1)
            
            const [prev_node, offset] = this.quill.getLeaf(idx_to_add)
            if(prev_node.domNode.nodeName === 'CITATION'){
                this.quill.insertText(idx_to_add, ',', 'script', 'super', 'api')
                idx_to_add++
            }

            // Should consider a better thing than this something like "global[this.var_name]"
            if (this.options.version !== CitationManagerModes.FULL_TEXT) {
                this.quill.insertEmbed(idx_to_add, 'citation', { index: currentArticle.instagram_citations?.[citation_key], key: citation_key }, 'api')

                Slide.setContents(currentSlide, this.quill.getContents())
                Article.updateInstaCitations(currentArticle)

                this.quill.setContents(currentSlide.content, 'api')
            } else {
                const adding_at_end = idx_to_add === this.quill.getLength() - 1

                let citation_idx = currentArticle?.full_text_citations?.[citation_key]
                if (citation_idx === undefined && adding_at_end) {
                    if (currentArticle.full_text_citations === undefined) {
                        citation_idx = 1
                    } else {
                        citation_idx = Object.keys(currentArticle.full_text_citations).length + 1
                    }
                }
                this.quill.insertEmbed(idx_to_add, 'citation', {
                    key: citation_key,
                    index: citation_idx
                }, 'api')

                Article.setFullLength(currentArticle, this.quill.getContents())
                Article.updateFullTextCitations(currentArticle, this.quill.getContents())
                document.getElementById('full-txt-references').innerHTML = getWorksCitedHTML(mainData.bib, currentArticle.full_text_citations)

                if (!adding_at_end) {
                    this.quill.setContents(currentArticle.full_text)
                }
            }

            this.quill.enable(true)
            this.quill.setSelection(idx_to_add + 1, Quill.sources.API);
        }).catch(err => {
            this.quill.deleteText(idx_to_add, 1)
            this.quill.enable(true)
            if (this.options.version !== CitationManagerModes.FULL_TEXT) {
                Slide.setContents(currentSlide, this.quill.getContents())
            }
        }).finally(() => {
            if (this.options.version !== CitationManagerModes.FULL_TEXT) {
                updateImagePreview(currentSlide, currentArticle.instagram_citations)
            }
        })
    }

    #getCitationKey(quill_idx) {
        return new Promise((resolve, reject) => {
            // First create the dropdown
            const drop_container = document.getElementById('citaitons-dropdown')
            const srcs_container = document.getElementById('sources-container')
            const search_box = document.getElementById('citation-search')
            drop_container.classList.remove('hidden')

            const processHTML = (bib) => {
                for (const pair of getCitationList(bib)) {
                    const item = document.createElement('div')
                    item.innerHTML = pair.div
                    item.classList.add('citation-list-item')

                    // Item should resolve the promise once clicked and hide everything
                    item.addEventListener('click', (e) => {
                        drop_container.classList.add('hidden')
                        resolve(pair.key)
                    })

                    srcs_container.appendChild(item)
                }
                drop_container.classList.remove('hidden')
                search_box.focus()
            }

            const { left, top } = this.quill.container.getBoundingClientRect()
            drop_container.style.left = `${left + this.quill.getBounds(quill_idx).left}px`
            drop_container.style.top = `${top + this.quill.getBounds(quill_idx).top}px`

            search_box.value = ""
            document.getElementById('citaitons-dropdown-close-btn').onclick = (e) => {
                drop_container.classList.add('hidden')
                reject('Clicked "Close"');
            }

            while (srcs_container.firstChild) {
                srcs_container.removeChild(srcs_container.firstChild);
            }

            if (currentArticle?.zotero_collection?.key === undefined || currentArticle?.zotero_collection?.key === "undefined") {
                processHTML(mainData.bib)
            } else if (cached_collection.key !== undefined && cached_collection.key === currentArticle.zotero_collection.key) {
                processHTML(cached_collection.bib)
            } else {
                getBib(
                    window.localStorage.getItem('zotero-user-id'),
                    window.localStorage.getItem('zotero-api-key'),
                    currentArticle.zotero_collection.key
                )
                    .then((bib) => {
                        cached_collection = createCachedZotero(currentArticle.zotero_collection.key, bib)
                        processHTML(bib)
                        for (const item of bib) {
                            if (!mainData.bib.includes(item)) {
                                mainData.bib.push(item)
                            }
                        }
                    })
            }
        })
    }

    static findDeletedBlobs(quill, retain, delete_length) {
        if (retain === undefined) retain = 0;
        const return_obj = new Array()
        let working_idx = 0
        let i = 0;
        while (retain >= working_idx) {
            return_obj[0] = quill.ops[i]
            working_idx += (typeof quill.ops[i].insert === 'string') ? quill.ops[i].insert.length : 1
            i++;
        }

        while (working_idx - retain < delete_length) {
            return_obj.push(quill.ops[i])
            working_idx += (typeof quill.ops[i].insert === 'string') ? quill.ops[i].insert.length : 1
            i++;
        }
        return return_obj
    }
}

class Article {
    static create() {
        return {
            slides: [Slide.create()],
            desc: "",
            instagram_citations: {},
            full_text: {},
            full_text_citations: {},
            zotero_collection: { key: undefined, name: "" }
        }
    }

    static updateInstaCitations(art) {
        art.instagram_citations = getCitationIndexes(art.slides)
    }

    static updateFullTextCitations(art, quill) {
        art.full_text_citations = getCitationIndexes([{
            content: quill
        }])
    }

    static setFullLength(art, quill) {
        art.full_text = quill
    }

    static setZoteroCollection(art, key, name) {
        art.zotero_collection = {
            key: key,
            name: name
        }
    }

    // Add a slide Object and return it
    static addSlide(art) {
        const new_slide = Slide.create();
        art.slides.push(new_slide)
        Article.updateInstaCitations(art)
        return new_slide
    }

    static moveSlideUp(art, slide) {
        moveItemUpInArray(slide, art.slides)
        Article.updateInstaCitations(art)
    }

    static moveSlideDown(art, slide) {
        moveItemDownInArray(slide, art.slides)
        Article.updateInstaCitations(art)
    }

    static removeSlide(art, slide) {
        const idx = art.slides.indexOf(slide)
        if (idx > -1) {
            art.slides.splice(idx, 1);
        }
        removeItemFromArr(slide, art.slides)

        Article.updateInstaCitations(art)
        if (art.slides.length === 0) {
            return Article.addSlide(art)
        } else {
            return art.slides[0]
        }
    }
}

class Slide {
    static create() {
        return {
            title: "",
            content: { ops: [] },
            img: {
                src: "",
                reverse_fit: false,
                hide_blr_bk: false,
                top: null,
                width: null
            }
        }
    }

    static saveProgress(slide) {
        // The description content is handled by quill

        slide.title = slide_title.value
        slide.content = quillSlide.getContents()
        if (slide.img.reverse_fit) {
            slide.img.top = getPosition()
            slide.img.width = getWidth()
        } else {
            slide.img.top = null
            slide.img.width = null
        }
    }

    static getTitle(slide) {
        return (slide.title === '') ? 'No Title' : slide.title
    }

    static getContent(slide) {
        return slide.content
    }

    static setContents(slide, content) {
        slide.content = content
    }

    static isReverseFit(slide) {
        return slide.img.reverse_fit
    }

    static isHideBlurredBackground(slide) {
        return slide.img.hide_blr_bk
    }
}

Quill.register('modules/citation', QuillCitationManager)


// Main data object
const mainData = (window.localStorage.getItem('data') === null) ? createCollectionObj() : JSON.parse(window.localStorage.getItem('data'));
var cached_collection = (window.localStorage.getItem('zotero-cache-collection') === null) ? createCachedZotero() : JSON.parse(window.localStorage.getItem('zotero-cache-collection'));
var currentArticle;
var currentSlide;
var curr_slide_list_item;

const quillSlide = new Quill('#slide_content', {
    modules: {
        toolbar: "#toolbar",
        history: {
            maxStack: 250,
            userOnly: true
        },
        citation: {
            version: CitationManagerModes.INSTAGRAM
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

const quillArticle = new Quill('#article-qill', {
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline'],        // toggled buttons

            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript

            ['clean']                                         // remove formatting button
        ],
        history: {
            maxStack: 250,
            userOnly: true
        },
        citation: {
            version: CitationManagerModes.FULL_TEXT
        }
    },
    placeholder: 'Write your full article here!',
    theme: 'snow',
    formats: [
        'bold',
        'italic',
        'link',
        'script',
        'underline',
        'header',
        'list',
        'formula',
        'image',
        'video',
        'citation'
    ]
});


const makeBaseAndUpdate = () => {
    Slide.saveProgress(currentSlide)
    // Article.updateInstaCitations(currentArticle)
    updateImagePreview(currentSlide, currentArticle.instagram_citations)
}

// When you change slide contents
quillSlide.on('text-change', (delta, oldContents, source) => {
    if (currentSlide && source === "user") {
        makeBaseAndUpdate()
    }
})

// When you change slide contents
quillDescription.on('text-change', (delta, old_contents, source) => {
    if (currentArticle && source === "user") {
        currentArticle.desc = quillDescription.getText().trim();
    }
})

// When you change slide contents
quillArticle.on('text-change', (delta, oldContents, source) => {
    if (currentArticle && source === "user") {
        currentArticle.full_text = quillArticle.getContents();
    }
})

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
    updateLoadingMessage(`Added Collection`)

    for (const art of mainData.articles) {
        updateLoadingMessage(`Working on article: ${art.slides[0].title}`)
        const folder_name = art.slides[0].title.replace(/[^a-zA-Z0-9 ]/g, "")
        const insta_citaitons = art.instagram_citations

        if (art?.full_text !== undefined) {
            quillArticle.setContents(art.full_text)
            zip.file(`${folder_name}/article.txt`, quillArticle.getText(), { binary: false })
            zip.file(`${folder_name}/article.json`, JSON.stringify(art.full_text))
            if(art?.full_text_citations !== undefined){
                zip.file(`${folder_name}/article_citations.html`, getWorksCitedHTML(mainData.bib, art?.full_text_citations))
            }
        }

        let instagram_desc = `🪡 ${art.slides[0].title.trim()}`
        if(art.desc.trim() !== "") {
            instagram_desc += `\n\n${art.desc.trim()}`
        }
        const works_cited_text = getWorksCitedText(mainData.bib, insta_citaitons)
        if(works_cited_text !== ""){
            instagram_desc += `\n\nResources:\n${works_cited_text}`
        }
        zip.file(`${folder_name}/instagram_desc.txt`, instagram_desc, { binary: false })

        for (let i = 0; i < art.slides.length; i++) {
            zip.file(`${folder_name}/${i}.jpeg`, exportSlideToJpegData(art.slides[i], insta_citaitons), { base64: true, createFolders: true })
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
        .catch(err => { console.trace(err) })
})


document.getElementById('z-collection-selector').addEventListener('input', e => {
    for (const options of e.target.children) {
        if (options.value === e.target.value) {
            Article.setZoteroCollection(currentArticle, e.target.value, options.text)
            return;
        }
    }
})

document.getElementById('insta-article-selector').addEventListener('click', (e) => {
    Slide.saveProgress(currentSlide)
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
    curr_slide_list_item.innerHTML = Slide.getTitle(currentSlide)
    if (currentSlide === currentArticle.slides[0]) {
        document.querySelector("#articles_list > .selected").innerHTML = Slide.getTitle(currentSlide)
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
            updateImagePreview(slide, currentArticle.instagram_citations).finally(hideLoading)
        })
        .finally(hideLoading)
})

document.getElementById('image-load-btn').addEventListener('click', e => {
    const file_loader = document.createElement('input')
    file_loader.type = "file"
    file_loader.accept = "image/*"
    file_loader.addEventListener('input', (e) => {
        try {
            const reader = new FileReader()

            reader.addEventListener("load", () => {
                // convert image file to base64 string
                currentSlide.img.src = reader.result;
                updateImagePreview(currentSlide, currentArticle.instagram_citations)
            }, false);

            reader.readAsDataURL(file_loader.files[0])
        } catch (error) {
            console.trace(error)
        }
    })

    file_loader.click()
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
    updateImagePreview(currentSlide, currentArticle.instagram_citations)
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
    currentSlide = Article.removeSlide(currentArticle, currentSlide)

    updateSlidesList(currentSlide)
})

// Add Slide Button
document.getElementById("nxt_btn").addEventListener('click', () => {
    if (currentArticle.slides.length < 10) {
        Slide.saveProgress(currentSlide)

        currentSlide = Article.addSlide(currentArticle)

        updateSlidesList(false);
        saveToBrowser(false);
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
    Slide.saveProgress(currentSlide)

    Article.moveSlideUp(currentArticle, currentSlide)

    updateSlidesList(false)
})

// Move slide Down Button
document.getElementById('move_slide_down').addEventListener('click', () => {
    Slide.saveProgress(currentSlide)

    Article.moveSlideDown(currentArticle, currentSlide)

    updateSlidesList(false)
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

function updateZotero() {
    return getZoteroCollections(
        window.localStorage.getItem('zotero-user-id'),
        window.localStorage.getItem('zotero-api-key')
    )
        .then(collections => {
            mainData.zotero_collections = collections
            return collections
        })
        .catch((new_credentials) => {
            window.localStorage.setItem('zotero-user-id', new_credentials.user_id)
            window.localStorage.setItem('zotero-api-key', new_credentials.api_key)
            return updateZotero()
        })
        .finally(() => {
            return getBib(
                window.localStorage.getItem('zotero-user-id'),
                window.localStorage.getItem('zotero-api-key')
            )
                .then(items_list => {
                    mainData.bib = items_list
                })
        })

}

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

function updateZoteroCollectionHTML(current_coll_key) {
    if (mainData?.zotero_collections === undefined) return;

    const zotero_drop_down = document.getElementById('z-collection-selector')
    while (zotero_drop_down.firstChild) {
        zotero_drop_down.removeChild(zotero_drop_down.firstChild)
    }

    const opt = document.createElement('option')
    opt.value = undefined
    opt.text = "Full Library"
    zotero_drop_down.appendChild(opt)

    for (const collection of mainData?.zotero_collections) {
        const opt = document.createElement('option')
        opt.value = collection.key
        opt.text = collection.name
        zotero_drop_down.appendChild(opt)

        if (collection.key === current_coll_key) {
            opt.selected = true
        }
    }
}

function updateArticlesList(update_current = true) {
    const list = document.getElementById("articles_list");
    clearChildren(list)

    if (mainData.articles.length > 0) {
        if (update_current) {
            currentArticle = mainData.articles[0];
        }
        for (let i = 0; i < mainData.articles.length; i++) {
            const new_it = document.createElement('li')
            const new_it_text = document.createTextNode(Slide.getTitle(mainData.articles[i].slides[0]))
            new_it.appendChild(new_it_text)
            new_it.value = i;
            new_it.addEventListener('click', (e) => {
                Slide.saveProgress(currentSlide)

                clearSelected(list)
                e.target.classList.add('selected')

                currentArticle = mainData.articles[i];
                updateSlidesList();

                quillDescription.setText((currentArticle?.desc === undefined) ? "" : currentArticle.desc)
                quillDescription.history.clear();

                quillArticle.setContents(currentArticle?.full_text)
                quillArticle.history.clear();
                document.getElementById('full-txt-references').innerHTML = getWorksCitedHTML(mainData.bib, currentArticle.full_text_citations)
            })

            if (mainData.articles[i] === currentArticle)
                new_it.classList.add('selected')
            list.appendChild(new_it);
        }

        quillDescription.setText((currentArticle?.desc === undefined) ? "" : currentArticle.desc)
        quillDescription.history.clear();

        quillArticle.setContents(currentArticle?.full_text)
        quillArticle.history.clear();
        document.getElementById('full-txt-references').innerHTML = getWorksCitedHTML(mainData.bib, currentArticle.full_text_citations)

        updateSlidesList(update_current);
    } else {
        addArticle(true)
    }

    updateZoteroCollectionHTML(currentArticle?.zotero_collection?.key)
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
            Slide.saveProgress(currentSlide);

            curr_slide_list_item.classList.remove('selected')
            e.target.classList.add('selected')
            currentSlide = slide
            curr_slide_list_item = e.target

            updateDOMSlide();
        })

        new_it.setAttribute("draggable", "true")

        new_it.addEventListener('dragover', draggoverHandler, false)

        new_it.addEventListener('drop', e => {
            dropHandler(e, slide).then(updated_slide => {
                if (updated_slide === currentSlide) {
                    updateImagePreview(updated_slide, currentArticle.instagram_citations)
                }
            })
        }, false)

        if (currentArticle.slides[i] === currentSlide) {
            curr_slide_list_item = new_it
            new_it.classList.add('selected')
        }
        list.appendChild(new_it);
    }

    updateDOMSlide();
}

function updateDOMSlide() {
    document.getElementById('inverse-fit-checkbox').checked = currentSlide.img.reverse_fit
    document.getElementById('hide-blurred-background-container').hidden = !currentSlide.img.reverse_fit
    document.getElementById('hide-blurred-background-checkbox').checked = currentSlide.img.hide_blr_bk
    slide_title.value = Slide.getTitle(currentSlide);
    quillSlide.setContents(Slide.getContent(currentSlide));
    quillSlide.history.clear();
    updateImagePreview(currentSlide, currentArticle.instagram_citations)
}

function addArticle(update_current = false) {
    currentArticle.desc = quillDescription.getText().trim()

    currentArticle = Article.create()
    currentSlide = currentArticle.slides[0]

    mainData.articles.push(currentArticle)
    updateArticlesList(update_current);
}

function removeArticle() {
    removeItemFromArr(mainData.articles, currentArticle)

    // It already makes new Article if needed
    updateArticlesList(true)
}

function saveToBrowser(update_current = true) {
    if (update_current) {
        Slide.saveProgress(currentSlide)
        Article.updateInstaCitations(currentArticle)
    }
    window.localStorage.setItem('data', JSON.stringify(mainData))
    window.localStorage.setItem('zotero-cache-collection', JSON.stringify(cached_collection))
}

function showLoading() {
    document.getElementById('loading-container').style.display = 'block'
}

function updateLoadingMessage(msg = "") {
    document.getElementsByClassName("loader-message")[0].textContent = msg
}

function hideLoading() {
    document.getElementById('loading-container').style.display = 'none'
    updateLoadingMessage("")
}

function clearChildren(el) {
    while (el.hasChildNodes()) {
        el.removeChild(el.firstChild);
    }
}

function clearSelected(el) {
    for (let i = 0; i < el.children.length; i++) {
        el.children[i].classList.remove('selected')
    }
}

// *************************************************************************************
// *************************************************************************************
// ********************************* NON-DOM FUNCTIONS *********************************
// *************************************************************************************
// *************************************************************************************

function createCollectionObj() {
    return {
        articles: [Article.create()]
    }
}

function createCachedZotero(key = undefined, bib = undefined) {
    return {
        key: key,
        bib: bib
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

function moveItemUpInArray(item, array) {
    const old_idx = array.indexOf(item)
    if (old_idx > 0) {
        [array[old_idx - 1], array[old_idx]] =
            [array[old_idx], array[old_idx - 1]]
    }
}

function moveItemDownInArray(item, array) {
    const old_idx = array.indexOf(item)
    if (old_idx < array.length - 1) {
        [array[old_idx], array[old_idx + 1]] =
            [array[old_idx + 1], array[old_idx]]
    }
}



// Check the policy agreement
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

updateArticlesList()
updateZotero().finally(() => {
    updateZoteroCollectionHTML(currentArticle?.zotero_collection?.key)
})