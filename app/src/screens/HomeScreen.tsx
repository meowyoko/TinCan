import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BottomNav} from '../components/BottomNav';
import {IconSketch} from '../components/IconSketch';
import {TopBar} from '../components/TopBar';
import {colors, radii, typography} from '../theme/colors';

type HomeScreenProps = {
  onOpenChat: () => void;
};

const modules = [
  ['聊天', '与 Ciel 对话', '☷', '3'],
  ['日记', '记录每日思考', '□', '1'],
  ['灵感', '素材与闪念', '◇', undefined],
  ['计划', '安排与追踪', '✎', undefined],
  ['档案', '查看资料', '▤', undefined],
] as const;

export function HomeScreen({onOpenChat}: HomeScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar leftLabel="☰" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.issueTitle}>
          <View style={styles.issueLine} />
          <Text style={styles.issueText}>今日首页 · 第六期</Text>
          <View style={styles.issueLine} />
        </View>

        <View style={styles.hero}>
          <Pressable accessibilityRole="button" onPress={onOpenChat} style={styles.continuePanel}>
            <Text style={styles.continueTitle}>继续对话</Text>
            <Text style={styles.continueBody}>上次我们聊到 Tin-Can 的 channel 注入和 MCP 回复链路。</Text>
            <View style={styles.continueFooter}>
              <Text style={styles.continueMeta}>上次记录 10:27</Text>
              <Text style={styles.continueButton}>继续对话 ›</Text>
            </View>
          </Pressable>

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>今日摘要</Text>
            <View style={styles.summarySketch} />
            <Text style={styles.summaryText}>Hub 队列、三级在线状态与 Android 壳已列入一期。</Text>
            <Text style={styles.summaryLink}>查看摘要 ›</Text>
          </View>
        </View>

        <View style={styles.ticker}>
          <Text style={styles.tickerLabel}>电讯速报</Text>
          <View style={styles.tickerDot} />
          <Text style={styles.tickerText}>Tin-Can 一期进入原生 App 骨架阶段</Text>
          <Text style={styles.tickerTime}>10:31 ›</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>模块入口</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.moduleRow}>
          {modules.map(([name, desc, mark, badge]) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              disabled={name !== '聊天'}
              onPress={name === '聊天' ? onOpenChat : undefined}
              style={styles.moduleItem}>
              <IconSketch label={mark} badge={badge} active={name === '聊天'} />
              <Text style={styles.moduleName}>{name}</Text>
              <Text style={styles.moduleDesc}>{desc}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.feature}>
          <View style={styles.featureCopy}>
            <Text style={styles.featureKicker}>速写  精选</Text>
            <Text style={styles.featureTitle}>移动端通信草图</Text>
            <Text style={styles.featureMeta}>2026 年 6 月 · 天气晴</Text>
            <Text style={styles.featureLike}>♡ 23</Text>
          </View>
          <View style={styles.featureImage} />
        </View>

        <View style={styles.editorial}>
          <View style={styles.plan}>
            <Text style={styles.editorialTitle}>今日计划</Text>
            <Text style={styles.editorialLine}>○ Hub typecheck        已完成</Text>
            <Text style={styles.editorialLine}>○ Android 壳           进行中</Text>
            <Text style={styles.editorialLink}>查看全部计划 ›</Text>
          </View>
          <View style={styles.editorialDivider} />
          <View style={styles.memory}>
            <Text style={styles.editorialTitle}>记忆回顾</Text>
            <Text style={styles.memoryStamp}>06/13</Text>
            <Text style={styles.editorialLine}>一期以正文气泡真实接入为主，其它卡片展示即可。</Text>
            <Text style={styles.editorialLink}>查看详情 ›</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav active="home" onOpenChat={onOpenChat} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    paddingBottom: 20,
  },
  issueTitle: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  issueLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  issueText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 15,
    lineHeight: 20,
  },
  hero: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  continuePanel: {
    flex: 0.68,
    minHeight: 160,
    borderRadius: radii.md,
    backgroundColor: colors.blueMain,
    padding: 16,
    justifyContent: 'space-between',
  },
  continueTitle: {
    color: colors.white,
    fontFamily: typography.serif,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  continueBody: {
    color: 'rgba(255,250,242,0.92)',
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 21,
  },
  continueFooter: {
    gap: 8,
  },
  continueMeta: {
    color: 'rgba(255,250,242,0.72)',
    fontSize: 11,
    lineHeight: 15,
  },
  continueButton: {
    alignSelf: 'flex-start',
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,250,242,0.55)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 4,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 16,
  },
  summary: {
    flex: 0.32,
  },
  summaryTitle: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  summarySketch: {
    height: 68,
    borderRadius: radii.sm,
    backgroundColor: '#D8D3C8',
    marginBottom: 8,
  },
  summaryText: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 19,
  },
  summaryLink: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: 4,
  },
  ticker: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tickerLabel: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 13,
    fontWeight: '600',
  },
  tickerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.terracotta,
  },
  tickerText: {
    flex: 1,
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 12,
  },
  tickerTime: {
    color: colors.inkSoft,
    fontSize: 11,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  moduleRow: {
    marginHorizontal: 16,
    minHeight: 118,
    flexDirection: 'row',
    marginBottom: 18,
  },
  moduleItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderLeftWidth: 1,
    borderLeftColor: colors.lineSoft,
    paddingHorizontal: 3,
  },
  moduleName: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  moduleDesc: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  feature: {
    marginHorizontal: 16,
    marginBottom: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    flexDirection: 'row',
    gap: 12,
  },
  featureCopy: {
    flex: 0.35,
    paddingBottom: 12,
  },
  featureKicker: {
    color: colors.terracotta,
    fontFamily: typography.serif,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  featureTitle: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  featureMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  featureLike: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  featureImage: {
    flex: 0.65,
    height: 140,
    borderRadius: radii.sm,
    backgroundColor: '#D8D3C8',
    transform: [{rotate: '1deg'}],
  },
  editorial: {
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    flexDirection: 'row',
  },
  plan: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 10,
  },
  memory: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 10,
  },
  editorialDivider: {
    width: 1,
    backgroundColor: colors.lineSoft,
    marginVertical: 10,
  },
  editorialTitle: {
    color: colors.ink,
    fontFamily: typography.serif,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 6,
  },
  editorialLine: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 18,
  },
  editorialLink: {
    color: colors.inkSoft,
    fontFamily: typography.serif,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },
  memoryStamp: {
    alignSelf: 'flex-end',
    color: colors.terracotta,
    backgroundColor: colors.memoryBg,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    overflow: 'hidden',
    marginBottom: 4,
  },
});
