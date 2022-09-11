document.addEventListener('DOMContentLoaded', () => {

    // https://stackoverflow.com/questions/56830928/calling-vscode-extension-for-data-from-webview

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'reload':
                init();
        }
    });

    init();
});

function init() {
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
    document.body.style.minHeight = "auto";
    window.scrollTo(0, 0);
}

function handleNext(event) {
    event.target.setAttribute('disabled', 'true');

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
