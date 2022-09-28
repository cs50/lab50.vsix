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

            // Extract YouTube video id and playlist id
            const yt_video_id = yt_parser(this.url, false);
            const yt_playlist_id = yt_parser(this.url, true);

            // If not on Codespace
            if (process.env["CODESPACES"] === undefined) {

                const placeholder = `
                <div class="container">
                    <img src="https://img.youtube.com/vi/${yt_video_id}/maxresdefault.jpg" alt="Click to play video">
                    <div class="overlay">
                        <a class="icon" title="Play video on YouTube" href="${this.url}">
                        <svg width="64" height="64" version="1.1" id="YouTube_Icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1024 721" enable-background="new 0 0 1024 721" xml:space="preserve">
                        <path id="Triangle" fill="#FFFFFF" d="M407,493l276-143L407,206V493z"/>
                        <path id="The_Sharpness" opacity="0.12" fill="#420000" d="M407,206l242,161.6l34-17.6L407,206z"/>
                        <g id="Lozenge">
                            <g>
                                    <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="512.5" y1="719.7" x2="512.5" y2="1.2" gradientTransform="matrix(1 0 0 -1 0 721)">
                                    <stop  offset="0" style="stop-color:#E52D27"/>
                                    <stop  offset="1" style="stop-color:#BF171D"/>
                                </linearGradient>
                                <path fill="url(#SVGID_1_)" d="M1013,156.3c0,0-10-70.4-40.6-101.4C933.6,14.2,890,14,870.1,11.6C727.1,1.3,512.7,1.3,512.7,1.3
                                    h-0.4c0,0-214.4,0-357.4,10.3C135,14,91.4,14.2,52.6,54.9C22,85.9,12,156.3,12,156.3S1.8,238.9,1.8,321.6v77.5
                                    C1.8,481.8,12,564.4,12,564.4s10,70.4,40.6,101.4c38.9,40.7,89.9,39.4,112.6,43.7c81.7,7.8,347.3,10.3,347.3,10.3
                                    s214.6-0.3,357.6-10.7c20-2.4,63.5-2.6,102.3-43.3c30.6-31,40.6-101.4,40.6-101.4s10.2-82.7,10.2-165.3v-77.5
                                    C1023.2,238.9,1013,156.3,1013,156.3z M407,493V206l276,144L407,493z"/>
                            </g>
                        </g>
                        </svg>
                        </a>
                    </div>
                </div>
                `;
                return placeholder.trim();
            }

            // On Codespace
            let ytEmbedLink = `https://www.youtube.com/embed/${yt_video_id}?modestbranding=0&rel=0&showinfo=1`;
            try {
                if (yt_playlist_id !== undefined) {
                    ytEmbedLink += `&list=${yt_playlist_id}`;
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
