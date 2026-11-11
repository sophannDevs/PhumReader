package app.phumreader.payment.service;

import app.phumreader.common.jobs.JobLock;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * PayWay housekeeping (plan P3-11): every minute orders past their 10 minutes are asked about one
 * last time and stored as EXPIRED; every night all unpaid orders of the last 7 days are compared
 * with PayWay's records, so a callback that never arrived (or arrived after the order expired)
 * still credits the coins, once. One API instance runs each job ({@link JobLock}).
 */
@Service
public class PaymentReconciler {

    private static final Logger log = LoggerFactory.getLogger(PaymentReconciler.class);

    private final PaymentService payments;
    private final JobLock lock;
    private final boolean enabled;

    public PaymentReconciler(
            PaymentService payments,
            JobLock lock,
            @Value("${phumreader.payments.reconcile-enabled:true}") boolean enabled) {
        this.payments = payments;
        this.lock = lock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void expireOverdueOrders() {
        if (enabled) {
            lock.runExclusively(
                    "payments-expire",
                    Duration.ofMinutes(5),
                    () -> run(payments.expiredOrderNumbers(), true));
        }
    }

    @Scheduled(cron = "${phumreader.payments.reconcile-cron:0 0 3 * * *}", zone = "Asia/Phnom_Penh")
    public void reconcileNightly() {
        if (enabled) {
            lock.runExclusively(
                    "payments-reconcile",
                    Duration.ofMinutes(30),
                    () -> run(payments.unpaidOrderNumbers(), false));
        }
    }

    /** Settles the given orders one by one; a failure on one never stops the rest. */
    public int run(List<String> orderNumbers, boolean closeExpired) {
        int paid = 0;
        for (String number : orderNumbers) {
            try {
                if (payments.settleFromPayWay(number, closeExpired)
                        == PaymentService.Settlement.PAID) {
                    paid++;
                }
            } catch (RuntimeException e) {
                log.warn("Could not reconcile order {}: {}", number, e.toString());
            }
        }
        if (!orderNumbers.isEmpty()) {
            log.info(
                    "Payment reconciliation: {} orders looked at, {} paid",
                    orderNumbers.size(),
                    paid);
        }
        return paid;
    }
}
