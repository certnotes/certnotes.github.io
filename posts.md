---
layout: page
title: "Posts"
permalink: /posts/
---

<div>
  <ul>
    {%- for post in site.posts -%}
    <li><p>
        <span style="font-weight:700; font-size:1.1em;">
        <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
      </span>{%- if post.tags and post.tags.size > 0 -%}<br>
          {%- for tag in post.tags -%}
            #{{ tag }}{% unless forloop.last %}, {% endunless %}
          {%- endfor -%}{%- endif -%}
  </p></li>
    {%- endfor -%}
  </ul>
</div>