let fontSize = 12;

document.addEventListener('DOMContentLoaded', () => {

    // https://stackoverflow.com/questions/56830928/calling-vscode-extension-for-data-from-webview

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'reload':
                init();
                break;

            case 'increaseFontSize':
                increaseFontSize();
                break;

            case 'decreaseFontSize':
                decreaseFontSize();
                break;
        }
    });

    init();
});

function increaseFontSize() {
    fontSize += 1;
    fontSize = Math.min(fontSize, 24);
    document.body.style.fontSize = `${fontSize}pt`;
    document.querySelectorAll('code').forEach((each) => {
        each.style.fontSize = `${fontSize}pt`;
    });
}

function decreaseFontSize() {
    fontSize -= 1;
    fontSize = Math.max(fontSize, 6);
    document.body.style.fontSize = `${fontSize}pt`;
    document.querySelectorAll('code').forEach((each) => {
        each.style.fontSize = `${fontSize}pt`;
    });
}

function init() {

    // handle next buttons
    try {
        let nextBtns = document.querySelectorAll('[data-next]');
        nextBtns.forEach((nextBtn) => {
            nextBtn.addEventListener('click', handleNext);
            nextBtn.removeAttribute('disabled');
        });

        // Hide all sibling elements beneath the first next button
        let next = nextBtns[0].parentElement.nextElementSibling;
        while (next != null) {
            next.classList.add('next');
            next.classList.add('fade-in');
            next = next.nextElementSibling;
        }
    } catch {}

    // handle MathJax
    try {
        // override mjx-container style to inline
        document.querySelectorAll('.MathJax').forEach((each) => {
            each.style.display = "inline";
        });
    } catch {}

    fontSize = 12;
    document.body.style.fontSize = `${fontSize}pt`;
    document.querySelectorAll('code').forEach((each) => {
        each.style.fontSize = `${fontSize}pt`;
    });
    document.body.style.minHeight = "auto";
    window.scrollTo(0, 0);
}

function handleNext(event) {
    event.target.setAttribute('disabled', 'true');
    event.target.classList.add('no-hover');

    let next = event.target.parentElement.nextElementSibling;
    next.classList.remove('next');

    whileLoop: while (next != null) {
        let children = next.children;
        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            if (child.hasAttribute('data-next')) {

                // If reaches the next "Next" button, stop the iteration
                child.parentElement.classList.remove('next');
                const top = event.target.offsetTop;
                const bottom = top + event.target.offsetHeight;
                document.body.style.minHeight = `${bottom + window.innerHeight}px`;
                window.scrollTo({top: bottom + 1, behavior: 'smooth'});
                break whileLoop;
            }
        }
        next.classList.remove('next');
        next = next.nextElementSibling;
    }
}
