# Transcript: "Claude Now Does Video (FOR FREE) Thanks To JavaScript" (Chase AI)

Source: https://www.youtube.com/watch?v=rscb1DgJtNg · 14:10 · published 2026-10-06.
Machine transcript (Whisper, from the audio; YouTube refused the subtitles). Not proofread: names and product
terms may be misheard ("Rizzo" is probably "riso", "Cloud Code" is Claude Code). Chapters: 0:00 Claude + JavaScript,
4:07 Level 1 prompting, 7:19 Level 2 tools and looping, 9:56 Level 3 references, 11:43 Level 4 skills.
What we take from it: `docs/social/learnings.md`.

You don't need remotion, you don't need After Effects. All you need is Claude code in JavaScript to create videos like
these. Whether it's a visual explainer, a product demo, or just pure motion graphics, these types of videos are
exploding right now. And that's because it's free. This isn't an AI video generator. This is just Claude and
JavaScript. And so today I'm going to show you how to create these sorts of videos for yourself. We're going to go
over how to properly prompt it, how to bring in reference images, and then how to codify this entire thing into a
skill so it can walk you through step zero all the way to a finished product. So how does this all work? How is Claude
able to create videos when it is not an AI video generation tool? Well, it uses JavaScript, which is a coding
language, to essentially create still images. It creates a bunch of still images, stitches those all together, exports
it as an MP4, and you get what you see here. In fact, I had it create a video explaining how this whole thing works.
So for this video, I told it to create it in the style of a three blue, one brown video, and this was a one-shot
attempt. This animation wasn't drawn by hand, and it isn't AI video. Claude wrote a function. Give it a time, T, and
it returns one picture. Ask for 60 pictures every second, play them in order, and that's a video. Same T, same picture
every time. So any frame can be redrawn or checked on its own. A headless browser draws each frame, FFmpeg stitches
them together, and the sound is a function of a T, too. Claude can't watch the video, but it can look at the frames,
spot what's wrong, and fix the function. So Claude never made a video. It wrote what the video is, a function of time.
So let's break that down just a little bit further. So as explained in the video, every single frame of the video
that's being created is generated via JavaScript. So this frame you saw right here is a function of JavaScript code.
That is one single frame. Every second, we create 60 versions of that frame, stitch them together, you now have one
second of video. Now what's cool with this system is we can have Claude code check its own work. So whether it's 60
frames or 240 frames, we essentially run the video in a headless browser using something like Playwright. So it's like
Claude code has its own version of Chrome that it's looking at. It can then take a look at each frame, frame by frame,
and then say, hmm, this works, this doesn't. Let's fix this, let's fix that. And then once it's happy, whether it
gives the thumbs up or you give it the thumbs up, it stitches them all via a tool called FFmpeg, which is totally open
source, and we get our video. And on top of that, we can easily add sound. The video you saw had the sound generated
with 11 labs, and first I created the script, and then we had sort of the graphics go along with it. And as you'll see
as we move along, there's a lot of different ways we can approach this sort of video creation piece. And again, what's
cool about this, it's all code, it's essentially free, I'm not paying for any outside tools to do this. Now I think
the easiest way to explain all this is kind of break it down into four different levels. The first level is how this
works purely from prompting. Second level is how we add sort of that looping element you saw in the video where it
checked its own work. Third, we'll talk about how do we bring in references to this, whether it's video references or
just style references via images. And then fourth, I'm gonna talk about how do you codify this entire thing. And by
codify, I mean handing you this skill that I've created that sort of walks you through the entire process we're gonna
go over today. But before we go through all four of these levels, a quick word from today's sponsor, me. So inside of
Chase AI+, I have just released an updated Cloud Code and Codex masterclass. And it is the number one way to go from
zero to AI dev, no matter your technical background or lack thereof. You also get access to my custom AIOS, which runs
not only on Codex, but Cloud Code as well. So if you're someone who wants to get a little more serious about AI, Chase
AI+, is the place for you. I'll put a link to it down in the pinned comment. So let's begin with prompting and effort
levels. So right here, I gave Opus 5.5 a pretty simple prompt. I said, make a dynamic 15 second motion graphics video
that shows what an incredible motion designer you are. Like it's a showreel for a resume. Go all out. Don't use any
skills. And I tested this on low, high and ultra code. Low knocked it out in like 20 minutes or so. High took like 30
minutes. Ultra code took eight hours. And what I want you to pay attention to is the quality difference between all of
these. And spoiler alert, high and low did just fine. Ultra code was definitely the best. But if you think your issue
with these videos or your sort of creations is an effort problem, it's probably not. It's probably just your prompts.
So here's low. Here's high. And here's Ultra. Now, all these were actually pretty solid, and even Lo did a pretty good
job. And what I wanted you to get from that is that the baseline ability of Claude using JavaScript is actually really
crazy with our prompts to get something that's actually quite legit. But there is one thing we can specifically do
that can make our outcomes way better, and that is to ask for a storyboard. This isn't something that should be wild
if you're someone who's done any sort of AI video generation. And the idea here is simple. Before we tell Claude to go
out there and create a 10, 15, 30, 60, five-minute video from one prompt, why don't we have it actually storyboarded
out for us, have it create some individual frames, which represent the different beats across the video. So we can get
sort of hands on on where we're going to be going with this creation before we just have it go off in code. Because
one thing I will say about these JavaScript creations is they can take a long time, especially if you start adding the
looping sequence like I'm going to introduce here in a second. So if I simply ask it to give me a storyboard, it's
going to give me something like this. It's going to say, hey, here's sort of like the seven big scenes you're see the
actual frames themselves before it's created. And so I can start changing things before anything has really been
coded. Because the worst thing and the worst scenario you can get in is you're creating an entire video. It takes 20
minutes. You get it back. You say, I don't like this or that. And it tries again. And you get into like this hour
long, three hour long loop of just like generation after generation. So simply asking for a storyboard before it
creates the video is going to save you so much time. So now let's move into level two, dive deeper into the prompt
structure as well as the outside dependencies we need to actually get this whole thing to work. Now, first things
first, when we do the prompt, hey, you just want to mention what is going to be the length and what type of video you
want to do. So like a 30 second animated explainer about how whatever works. You're also going to want to mention sort
of the aspect ratio you want to do this in. Is it going to be a full screen video or we're doing something vertical
that's for like short form social media? Then we definitely want to mention JavaScript, Then we want to talk about the
soundtrack. The soundtrack can be pure code, and that's what a lot of these things are, but you can totally supply
your own soundtrack to Claude Code. In fact, you can kind of work backwards. When we were doing that video where I had
to do the explainer for you, where we actually had an audio and narrator, I gave it the audio first of the narration,
and then it worked backwards from there and made sure the visuals matched the audio. So you have that option as well.
Third, we want to say, make sure you render it to an MP4 with Playwright and FFmpeg. So we mentioned Playwright
specifically because Playwright is what's going to allow Cloud Code to run that headless browser to check to see, hey,
do all these frames make sense? And FFmpeg is what we are going to use to actually stitch everything together. Now,
after that, we can mention, like I said earlier, hey, here's the voice MP3, time the visuals to it. And then at the
end, what we want to say is before you call it done, use FFmpeg to pull a contact sheet, look at it, fix what's wrong,
re-render and repeat. You don't have to use this exact verbiage, but you need to mention something somewhere along the
lines of, hey, before you're done, check your work with FFMpeg and Playwright and make sure everything aligns and
makes sense. Now, Opus 5.5 and Fable 5.1 are so good that if you don't even mention these things, it's probably going
to do it, but you should understand how this all works. So if it isn't doing what you want, So, to recap, you need
Playwright, you need FFmpeg, and you also need to figure out how do you want this actually created. Are you going to
do the visuals first and then audio afterwards? Or do you have audio with a soundtrack or maybe a narration, and then
I want the graphics to match that. Again, when you're talking about narration, we can use something like Eleven Labs,
but there are a ton of open source resources to create that narration as well. Although I will say Eleven Labs is
probably the best thing out there. They just came out with their MCP. This isn't supposed to be a good one. sponsored
by 11 Labs whatsoever, but I do like their product. And I believe their subscription is like five bucks a month, which
is relatively cheap. Now, level three is where we go beyond simple prompts and we start adding references. This can
either be images and we can say, hey, I want you to insert this actual image, or I want you to copy its sort of
aesthetic style, or we can give it actual video and say, can we use the composition of this video as inspiration for
what we are trying to create? And we're just going to insert unique content. Now, Claude's really good at this. On the
left, we have the reference video, I fed it. This was created with Opus 5.5 and Remotion. And on the right is our
JavaScript recreation. So on the left-hand side, it was a video about currency. And on the right-hand side, it was
about explaining sort of the history of electricity. So we'll watch this for a couple seconds so you can see what a
good job it does. And so we'll stop it there. But you can see in terms of the composition from the reference to our
version, it's pretty close. It looks like it's from the same family of design, yet the actual content is completely
different. Now, as for where to find this sort of inspiration, there's obviously a million and one places. One place I
like is this website called skillery.dev. So skill, S-K-I-L-L-R-Y.dev. videos. So you can browse different Opus 5.5
videos to sort of like start getting your mind turning as for what you want to do. This is paid, but on the free
version, you can still see quite a few. Another really good place is Twitter. And I think this guy, Kevin, is probably
the best out there when it comes to creating these sort of videos. So I highly suggest taking a look at his profile
and seeing like what the upper level of this sort of content creation really looks like. And lastly, at level four, we
want to be able to codify this process. We want to turn it into some that Claude can do over and over again. And the
best way to do this is by simply turning it into a skill, which is what I've done here and it's what I'm giving you
today. So this Claude code skill essentially uses the whole JavaScript format we've been talking about and it just
walks you through it. It comes with seven preloaded different styles, cut paper, crosshatch, Rizzo, sketchbook,
isometric, but you have the ability to do custom styles just by doing what I said, handing it some sort of reference
image Now the skill goes through a number of stages and the best part is it walks you through it. So it starts with an
intake where it's going to ask you a bunch of questions in terms of what's your subject? What do you want the format
to be? What do you want to do with the audio, the voice? Do you want sort of like some sort of hero character that
gets seen from, you know, the first scene all the way till the end? From there, we talk about what the story is going
to look like. We eventually push it all the way to a storyboard like we talked about earlier. So we can actually get
sort of like eyes on what each scene will look like before we actually create the whole thing. And then finally we
code it and deliver it to you. And throughout this entire process, Claude will loop through the video it's created to
make sure everything syncs up and makes sense. That whole sort of loop we talked about earlier with Playwright and
FFmpeg. It's going to do that all automatically. You just need to answer the questions the skill prompts you for and
provide whatever references you want. Installing it is super easy. You can do it as a plugin or you can just hand this
URL to Claude Code and it will do everything for you. It will also make sure you have all the prerequisites and
dependencies like Playwright, like FFmpeg, like things like Faster Whisper. And it will even ask if you want to do
something like the 11labs connector. Now this thing is very much a work in progress. I've been messing with it a ton.
So if you decide to use this for yourself and you come up with your own sort of improvements, definitely open up a PR
and let me add that to what everyone is using. So that's where I'm going to leave you guys for today. I hope you got
something out of it. I think these JavaScript videos are awesome because like I keep saying, they're pretty much free.
We just pay for it with usage. There's no third party AI image generator or AI video generator we need to use to
create these things and the level, the quality is really high. We just need to know how to prompt it and how to give
it references. So as always, let me know what you thought. Make sure to check out Chase AI Plus if you want to get
your hands on my Claude Code Masterclass. And besides that, I'll see you around.
