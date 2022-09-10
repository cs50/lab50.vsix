import { Liquid } from 'liquidjs';

export function liquidEngine() {

    // Parse and render README.md
    const engine = new Liquid();

    // Register a next tag
    engine.registerTag('next', {
        render: async function(ctx) {
            const htmlString = `<button class="btn btn-success" data-next type="button">Next</button>`;
            return htmlString.trim();
        }
    });

    // Register a video tag
    engine.registerTag('video', {
        parse: function(tagToken) {
            this.url = tagToken.args.replaceAll('"', "").trim();
        },
        render: async function() {
            const ytEmbedLink = `https://www.youtube.com/embed/${yt_parser(this.url)}`;
            const htmlString = `<div class="ratio ratio-16x9"><iframe sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-top-navigation allow-presentation" width="560" height="315" src="${ytEmbedLink}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

            return htmlString.trim();
        }
    });

    // Register a spoiler tag (ends with endspoiler)
    engine.registerTag('spoiler', {
        parse: function(tagToken, remainTokens) {
            this.tpls = [];
            this.args = tagToken.args;

            // Parse spoiler summary (default to "Spoiler")
            this.summary = this.args.replaceAll('"', "").trim();
            if (this.summary == '') {
                this.summary = 'Spoiler';
            }

            let closed = false;
            while(remainTokens.length) {
                const token = remainTokens.shift();

                // we got the end tag! stop taking tokens
                if (token.getText() === '{% endspoiler %}') {
                    closed = true;
                    break;
                }

                // parse token into template
                // parseToken() may consume more than 1 tokens
                // e.g. {% if %}...{% endif %}
                const tpl = this.liquid.parser.parseToken(token, remainTokens);
                this.tpls.push(tpl);
            }
            if (!closed) throw new Error(`tag ${tagToken.getText()} not closed`);
        },
        * render(context, emitter) {
        emitter.write(`<details class='spoiler'>`);
        emitter.write(`<summary style="cursor: pointer;">${this.summary}</summary>`);
        yield this.liquid.renderer.renderTemplates(this.tpls, context, emitter);
        emitter.write("</details>");
        }
    });
    return engine;
}

// Helper function to parse youtube id from url
function yt_parser(url: string){
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match&&match[7].length==11)? match[7] : false;
}
