---
layout: page
title: Tags
permalink: /tags/
---

{% assign min_count = 1 %}
{% assign max_tags  = 30 %}

{%- capture tag_str -%}{%- endcapture -%}
{% for t in site.tags %}
  {% assign name = t[0] %}
  {% assign count = t[1].size %}
  {% if count >= min_count %}
    {% assign padded = count | plus: 0 | prepend: "00000" | slice: -5, 5 %}
    {%- capture tag_str -%}{{ tag_str }}{{ padded }}::{{ name }}||{%- endcapture -%}
  {% endif %}
{% endfor %}

{% assign tag_arr = tag_str | split: "||" | sort %}
{% assign shown = 0 %}

{% for item in tag_arr reversed %}
  {% if item == "" %}{% continue %}{% endif %}
  {% assign parts = item | split: "::" %}
  {% assign count = parts[0] | plus: 0 %}
  {% assign name  = parts[1] %}

### <span id="{{ name | slugify }}">{{ name }}</span>

{% for post in site.tags[name] %}
- [{{ post.title }}]({{ post.url }})
{% endfor %}

  {% assign shown = shown | plus: 1 %}
  {% if shown >= max_tags %}{% break %}{% endif %}
{% endfor %}
