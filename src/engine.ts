import { Liquid } from 'liquidjs';
import * as luxon from "luxon";

export function liquidEngine() {

    // Parse and render README.md
    const engine = new Liquid();

    // Register a local tag
    engine.registerTag('local', {
        parse: function(tagToken) {
            this.args = tagToken.args.replaceAll('"', '').trim().split(' ');
            console.log(this.args);
        },
        render: async function(ctx) {

            let html = "invalid datetime";

            // Default options
            const locale = 'en';
            const tz = 'America/New_York'; // enforce EST/EDT timezone for now

            // Case 1: one argument, a quoted date and time in YYYY-MM-DD HH:MM format
            if (this.args.length == 2) {
                const date = this.args[0];
                const time = this.args[1];
                const timeString = `${date}T${time}`;
                const start = luxon.DateTime.fromISO(timeString, {zone: tz}).setLocale('en');
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
            }

            // Case 2: two arguments, a quoted start date and time in YYYY-MM-DD HH:MM format followed by a quoted end time in HH:MM format, provided that the end time is within 24 hours of the start time
            if (this.args.length == 3) {
                const date = this.args[0];
                const startTime = this.args[1];
                const start = luxon.DateTime.fromISO(`${date}T${startTime}`, {zone: tz}).setLocale('en');
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
            }

            // Case 3: two arguments, a quoted start date and time in YYYY-MM-DD HH:MM format followed by a quoted end date and time in YYYY-MM-DD HH:MM format
            if (this.args.length == 4) {

                const startDate = this.args[0];
                const startTime = this.args[1];
                const start = luxon.DateTime.fromISO(`${startDate}T${startTime}`, {zone: tz}).setLocale('en');
                const endDate = this.args[2];
                const endTime = this.args[3];
                const end = luxon.DateTime.fromISO(`${endDate}T${endTime}`, {zone: tz});

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
                }
            }

            return html;
        }
    });

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
