import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Body, Card } from '@/components/ui'
import { SwatchDot } from '@/components/Swatch'
import type { OutfitPost } from '@/lib/api'
import { formatDeadline } from '@/lib/shared'
import { colors, fonts } from '@/theme'

export function OutfitCard({
  post,
  isMine,
  busy,
  onLike,
  onDelete,
  onOpenPhoto,
}: {
  post: OutfitPost
  isMine: boolean
  busy: boolean
  onLike: () => void
  onDelete: () => void
  onOpenPhoto: (url: string) => void
}) {
  return (
    <Card style={styles.card}>
      <Pressable onPress={() => onOpenPhoto(post.image_url)} accessibilityLabel={`View ${post.display_name}'s outfit`}>
        <Image source={post.image_url} style={styles.photo} contentFit="cover" transition={150} />
      </Pressable>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Body style={styles.name}>{post.display_name}</Body>
          {post.caption ? <Body muted>{post.caption}</Body> : null}
        </View>
        <Pressable
          onPress={onLike}
          disabled={busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: post.liked_by_me }}
          style={styles.like}
        >
          <Text style={[styles.heart, post.liked_by_me && { color: colors.terracotta }]}>
            {post.liked_by_me ? '♥' : '♡'}
          </Text>
          {post.like_count > 0 && <Body style={styles.likeCount}>{post.like_count}</Body>}
        </Pressable>
      </View>
      {post.colors && post.colors.length > 0 && (
        <View style={styles.dots}>
          {post.colors.map((c) => (
            <SwatchDot key={c} value={c} size={16} />
          ))}
        </View>
      )}
      {isMine && (
        <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" style={styles.deleteLink}>
          <Body style={styles.deleteText}>Delete my post</Body>
        </Pressable>
      )}
    </Card>
  )
}

export function PollCard({
  post,
  isMine,
  busy,
  onVote,
  onPickWinner,
  onDelete,
  onOpenPhoto,
}: {
  post: OutfitPost
  isMine: boolean
  busy: boolean
  onVote: (optionId: string) => void
  onPickWinner: (optionId: string) => void
  onDelete: () => void
  onOpenPhoto: (url: string) => void
}) {
  const options = [...(post.options ?? [])].sort((a, b) => a.position - b.position)
  const showResults = post.total_votes !== null
  const leading = showResults ? Math.max(...options.map((o) => o.votes ?? 0)) : 0

  return (
    <Card style={styles.card}>
      <Body>
        <Body style={styles.name}>{post.display_name}</Body>
        <Body muted> can&apos;t decide</Body>
        {post.caption ? <Body> — {post.caption}</Body> : null}
      </Body>
      <View style={styles.options}>
        {options.map((o, i) => {
          const votes = o.votes ?? 0
          const pct = showResults && post.total_votes ? Math.round((votes / post.total_votes) * 100) : 0
          const isMyVote = post.my_vote === o.id
          const isLeading = showResults && votes > 0 && votes === leading
          return (
            <View key={o.id} style={styles.option}>
              <Pressable onPress={() => onOpenPhoto(o.image_url)} accessibilityLabel={`View option ${i + 1}`}>
                <Image
                  source={o.image_url}
                  style={[styles.optionPhoto, isMyVote && styles.optionPicked]}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.optionBadge}>
                  <Text style={styles.optionBadgeText}>{i + 1}</Text>
                </View>
              </Pressable>
              {showResults && (
                <View>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: isLeading ? colors.terracotta : colors.stoneMuted },
                      ]}
                    />
                  </View>
                  <Body muted style={styles.small}>
                    {pct}% · {votes}
                    {isMyVote ? ' · yours' : ''}
                  </Body>
                </View>
              )}
              {isMine ? (
                <Pressable
                  onPress={() => onPickWinner(o.id)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Wear option ${i + 1}`}
                  style={[styles.voteButton, busy && { opacity: 0.5 }]}
                >
                  <Text style={styles.voteText}>Wear this one</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onVote(o.id)}
                  disabled={busy || isMyVote}
                  accessibilityRole="button"
                  accessibilityLabel={`Vote for option ${i + 1}`}
                  style={[styles.voteButton, isMyVote && styles.voteButtonOn]}
                >
                  <Text style={[styles.voteText, isMyVote && { color: colors.cream }]}>
                    {isMyVote ? 'Your vote' : post.my_vote ? 'Switch' : 'Vote'}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </View>
      <Body muted style={styles.small}>
        {showResults
          ? `${post.total_votes} vote${post.total_votes === 1 ? '' : 's'}${isMine ? ' · pick the one you’re wearing to close the poll' : ''}`
          : 'Vote to see results.'}
      </Body>
      {post.poll_closes_at && (
        <Body muted style={styles.small}>
          Voting closes {formatDeadline(post.poll_closes_at)}.{' '}
          {isMine ? 'If you haven’t picked by then, the top vote wins.' : 'Then the top vote wins.'}
        </Body>
      )}
      {isMine && (
        <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" style={styles.deleteLink}>
          <Body style={styles.deleteText}>Delete my poll</Body>
        </Pressable>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 10 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: colors.creamDark },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontFamily: fonts.sansBold },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  heart: { fontSize: 22, color: colors.stoneMuted },
  likeCount: { fontSize: 14, color: colors.stoneMuted },
  dots: { flexDirection: 'row', gap: 6 },
  deleteLink: { alignSelf: 'flex-start' },
  deleteText: { color: colors.terracottaDark, fontSize: 13 },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, gap: 6 },
  optionPhoto: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: colors.creamDark },
  optionPicked: { borderWidth: 3, borderColor: colors.terracotta },
  optionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(250,243,236,0.92)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  optionBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.stone },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.stoneLine, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  small: { fontSize: 12, lineHeight: 17 },
  voteButton: {
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 999,
    paddingVertical: 6,
    alignItems: 'center',
  },
  voteButtonOn: { backgroundColor: colors.terracotta },
  voteText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.terracotta },
})
