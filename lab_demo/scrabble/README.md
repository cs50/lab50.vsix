---
files: [scrabble.c]
window: [terminal]
---

# Lab 2: Scrabble

{% alert warning %}

Labs are practice problems which, time permitting, may be started or completed in your section, and are assessed on correctness only. You are encouraged to collaborate with classmates on this lab, though each member in a group collaborating is expected to contribute equally to the lab.

{% endalert %}

Determine which of two Scrabble words is worth more.

```
$ ./scrabble
Player 1: COMPUTER
Player 2: science
Player 1 wins!
```

## Background

In the game of [Scrabble](https://scrabble.hasbro.com/en-us/rules), players create words to score points, and the number of points is the sum of the point values of each letter in the word.

|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|
|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|
|1|3|3|2|1|4|2|4|1|8|5|1|3|1|1|3|10|1|1|1|1|4|4|8|4|10|

For example, if we wanted to score the word `Code`, we would note that in general Scrabble rules, the `C` is worth `3` points, the `o` is worth `1` point, the `d` is worth `2` points, and the `e` is worth `1` point. Summing these, we get that `Code` is worth `3 + 1 + 2 + 1 = 7` points.

## Implementation Details

Complete the implementation of `scrabble.c`, such that it determines the winner of a short scrabble-like game, where two players each enter their word, and the higher scoring player wins.

* Notice that we've stored the point values of each letter of the alphabet in an integer array named `POINTS`.
  * For example, `A` or `a` is worth 1 point (represented by `POINTS[0]`), `B` or `b` is worth 3 points (represented by `POINTS[1]`), etc.
* Notice that we've created a prototype for a helper function called `compute_score()` that takes a string as input and returns an `int`. Whenever we would like to assign point values to a particular word, we can call this function. Note that this prototype is required for C to know that `compute_score()` exists later in the program.
* In `main()`, the program prompts the two players for their words using the `get_string()` function. These values are stored inside variables named `word1` and `word2`.
* In `compute_score()`, your program should compute, using the `POINTS` array, and return the score for the string argument. Characters that are not letters should be given zero points, and uppercase and lowercase letters should be given the same point values.
  * For example, `!` is worth `0` points while `A` and `a` are both worth `1` point.
  * Though Scrabble rules normally require that a word be in the dictionary, no need to check for that in this problem!
* In `main()`, your program should print, depending on the players' scores, `Player 1 wins!`, `Player 2 wins!`, or `Tie!`.

### Walkthrough

{% alert primary %}

This video was recorded when the course was still using CS50 IDE for writing code. Though the interface may look different from your codespace, the behavior of the two environments should be largely similar!

{% endalert %}

{% video https://video.cs50.io/RtjxxxlN1gc %}

### Hints

* You may find the functions `isupper()` and `islower()` to be helpful to you. These functions take in a character as the argument and return a boolean.

* To find the value at the `n`th index of an array called `arr`, we can write `arr[n]`. We can apply this to strings as well, as strings are arrays of characters.

* Recall that computers represent characters using [ASCII](http://asciitable.com/), a standard that represents each character as a number.

{% spoiler "Not sure how to solve?" %}

{% video https://video.cs50.io/USiLkXuXJEg %}

{% endspoiler %}

### How to Test Your Code

Your program should behave per the examples below.

```
$ ./scrabble
Player 1: Question?
Player 2: Question!
Tie!
```

```
$ ./scrabble
Player 1: Oh,
Player 2: hai!
Player 2 wins!
```

```
$ ./scrabble
Player 1: COMPUTER
Player 2: science
Player 1 wins!
```

```
$ ./scrabble
Player 1: Scrabble
Player 2: wiNNeR
Player 1 wins!
```

Execute the below to evaluate the correctness of your code using `check50`. But be sure to compile and test it yourself as well!

```
check50 cs50/labs/2022/fall/scrabble
```

Execute the below to evaluate the style of your code using `style50`.

```
style50 scrabble.c
```

## How to Submit

1. Download your `scrabble.c` file by control-clicking or right-clicking on the file in your codespace's file browser and choosing **Download**.
1. Go to CS50's [Gradescope page](https://www.gradescope.com/courses/411020).
1. Click "Lab 2: Scrabble".
1. Drag and drop your `scrabble.c` file to the area that says "Drag & Drop". Be sure it has that **exact** filename! If you upload a file with a different name, the autograder likely will fail when trying to run it, and ensuring you have uploaded files with the correct filename is your responsibility!
1. Click "Upload".

You should see a message that says "Lab 2: Scrabble submitted successfully!"

{% spoiler "Want to see the staff's solution?" %}
```c
#include <ctype.h>
#include <cs50.h>
#include <stdio.h>
#include <string.h>

// Points assigned to each letter of the alphabet
int POINTS[] = {1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10};

int compute_score(string word);

int main(void)
{
    // Get input words from both players
    string word1 = get_string("Player 1: ");
    string word2 = get_string("Player 2: ");

    // Score both words
    int score1 = compute_score(word1);
    int score2 = compute_score(word2);

    // Print the winner
    if (score1 > score2)
    {
        printf("Player 1 wins!\n");
    }
    else if (score1 < score2)
    {
        printf("Player 2 wins!\n");
    }
    else
    {
        printf("Tie!\n");
    }
}

int compute_score(string word)
{
    // Keep track of score
    int score = 0;

    // Compute score for each character
    for (int i = 0, len = strlen(word); i < len; i++)
    {
        if (isupper(word[i]))
        {
            score += POINTS[word[i] - 'A'];
        }
        else if (islower(word[i]))
        {
            score += POINTS[word[i] - 'a'];
        }
    }

    return score;
}
```
{% endspoiler %}
