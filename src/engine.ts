import { Liquid } from 'liquidjs';
import * as luxon from "luxon";

export function liquidEngine() {

    // Parse and render README.md
    const engine = new Liquid();

    // Register a local tag
    engine.registerTag('local', {
        parse: function(tagToken) {
            this.args = tagToken.args.replaceAll('"', '').trim().split(' ');
        },
        render: async function(ctx) {

            let html = "invalid datetime";
            let local;

            // Default options
            const locale = 'en';

            // Case 1: one argument, a quoted date and time in YYYY-MM-DD HH:MM format
            if (this.args.length == 2) {
                const date = this.args[0];
                const time = this.args[1];
                const timeString = `${date}T${time}`;
                const start = luxon.DateTime.fromISO(timeString).setLocale('en');
                const opts = {
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    month: 'long',
                    timeZoneName: 'short',
                    weekday: 'long',
                    year: 'numeric'
                }

                html = start.toLocaleString(opts);
                local = `${start}`;
            }

            // Case 2: two arguments, a quoted start date and time in YYYY-MM-DD HH:MM format followed by a quoted end time in HH:MM format, provided that the end time is within 24 hours of the start time
            if (this.args.length == 3) {
                const date = this.args[0];
                const startTime = this.args[1];
                const start = luxon.DateTime.fromISO(`${date}T${startTime}`).setLocale('en');
                const startOpts = {
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    month: 'long',
                    weekday: 'long',
                    year: 'numeric'
                }

                const endTime = this.args[2];
                const end = luxon.DateTime.fromISO(`${endTime}`);
                const endOpts = {
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short'
                }

                html = `${start.toLocaleString(startOpts)} - ${end.toLocaleString(endOpts)}`;
                local = `${start}/${end}`;
            }

            // Case 3: two arguments, a quoted start date and time in YYYY-MM-DD HH:MM format followed by a quoted end date and time in YYYY-MM-DD HH:MM format
            if (this.args.length == 4) {

                const startDate = this.args[0];
                const startTime = this.args[1];
                const start = luxon.DateTime.fromISO(`${startDate}T${startTime}`).setLocale('en');
                const endDate = this.args[2];
                const endTime = this.args[3];
                const end = luxon.DateTime.fromISO(`${endDate}T${endTime}`);

                const opts = {
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    month: 'long',
                    weekday: 'long',
                    year: 'numeric'
                }

                if (locale === 'en' && (
                    start.toLocaleString(luxon.DateTime.DATE_SHORT) === end.toLocaleString(luxon.DateTime.DATE_SHORT) ||
                    end.toLocaleString(luxon.DateTime.TIME_24_WITH_SECONDS) === '24:00:00' &&
                        start.toLocaleString(luxon.DateTime.DATE_SHORT) == end.minus({days: 1}).toLocaleString(luxon.DateTime.DATE_SHORT))) {

                    // Format end without date
                    html = start.toLocaleString(opts) + ' – ' + end.toLocaleString({
                        hour: 'numeric',
                        minute: 'numeric',
                        timeZoneName: 'short'
                    });
                    local = `${start}/${end}`;
                }

                else {

                    // Format end with date
                    html = start.toLocaleString(opts) + ' – ' + end.toLocaleString({
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        month: 'long',
                        timeZoneName: 'short',
                        weekday: 'long',
                        year: 'numeric'
                    });
                    local = `${start}/${end}`;
                }
            }

            const clock = `<a data-clock href="https://time.cs50.io/${local}"><i class="far fa-clock" title="CS50 Time Converter"></i></a>`;

            html = `<p><span>${html} clock: ${clock}</span></p>`;
            return html;
        }
    });

    // Register an alert tag
    engine.registerTag('alert', {
        parse: function(tagToken, remainTokens) {
            this.tpls = [];
            this.args = tagToken.args;

            let closed = false;
            while(remainTokens.length) {
                const token = remainTokens.shift();

                // we got the end tag! stop taking tokens
                if (token.getText() === '{% endalert %}') {
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
        emitter.write(`<p><div class="alert" role="alert">`);
        yield this.liquid.renderer.renderTemplates(this.tpls, context, emitter);
        emitter.write("</div></p>");
        }
    });

    // Register a next tag
    engine.registerTag('next', {
        render: async function(ctx) {
            const htmlString = `<p><button class="btn btn-success" data-next type="button">Next</button></p>`;
            return htmlString.trim();
        }
    });

    // Register a video tag
    engine.registerTag('video', {
        parse: function(tagToken) {
            this.url = tagToken.args.replaceAll('"', "").trim();
        },
        render: async function() {

            // If not on Codespace
            if (process.env["CODESPACES"] === undefined) {
                return `<a href="${this.url}">${this.url}</a>`;
            }

            let ytEmbedLink = `https://www.youtube.com/embed/${yt_parser(this.url, false)}?modestbranding=0&rel=0&showinfo=1`;

            try {
                const plyatlistId = yt_parser(this.url, true);
                if (plyatlistId !== undefined) {
                    ytEmbedLink += `&list=${plyatlistId}`;
                }
            } catch (error) {
                console.log(error);
            }

            const htmlString = `<p><div class="ratio ratio-16x9"><iframe src="${ytEmbedLink}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen ></iframe></div></p>`;
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

            // Default state to "open" to address some of the iframe sizing issues (e.g., asciinema)
            emitter.write(`<p><details class='spoiler' open>`);
            emitter.write(`<summary style="cursor: pointer;">${this.summary}</summary>`);
            yield this.liquid.renderer.renderTemplates(this.tpls, context, emitter);
            emitter.write("</details></p>");
        }
    });
    return engine;
}

// Helper function to parse youtube id from url
function yt_parser(url: string, playlist: boolean){
    let regExp;
    let match;
    if (playlist) {
        regExp = /[&?]list=([^&]+)/i;
        match = url.match(regExp);
        return (match && match.length > 1) ? match[1] : undefined;
    } else {
        regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        match = url.match(regExp);
        return (match) ? match[7] : undefined;
    }
}
